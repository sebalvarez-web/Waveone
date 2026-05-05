import type { Corredor, Plan, Transaccion, Pausa, PagoAplicado } from "@/types/database";

export type MesEstado = "pagado" | "deuda" | "pausa" | "futuro";

export interface MesDeuda {
  year: number;
  month: number;
  estado: MesEstado;
  monto: number;
}

export interface DeudaCorredor {
  corredor: Corredor;
  meses: MesDeuda[];
  totalDeuda: number;
  mesesDeudaCount: number;
}

/** Cambio de plan registrado en `corredor_historial` (tipo = "cambio_plan"). */
export interface CambioPlan {
  corredor_id: string;
  fecha: string; // ISO
  plan_id_anterior: string | null;
  plan_id_nuevo: string | null;
}

/**
 * Construye segmentos de plan por corredor para resolver el plan vigente
 * en cualquier mes histórico. Retorna lista ordenada asc por fecha.
 */
function buildPlanSegments(
  corredor: Corredor,
  cambios: CambioPlan[]
): Array<{ desde: Date; planId: string | null }> {
  const ordenados = [...cambios].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  const segmentos: Array<{ desde: Date; planId: string | null }> = [];
  const ingreso = new Date(corredor.fecha_ingreso.split("T")[0] + "T00:00:00");

  // Plan inicial: el plan_id_anterior del primer cambio, o el plan actual si no hay cambios.
  const planInicial = ordenados[0]?.plan_id_anterior ?? corredor.plan_id ?? null;
  segmentos.push({ desde: ingreso, planId: planInicial });

  for (const c of ordenados) {
    segmentos.push({
      desde: new Date(c.fecha.split("T")[0] + "T00:00:00"),
      planId: c.plan_id_nuevo,
    });
  }
  return segmentos;
}

function precioEnMes(
  segmentos: Array<{ desde: Date; planId: string | null }>,
  planesById: Map<string, Plan>,
  fallbackPrecio: number,
  year: number,
  month: number
): number {
  // Tomamos el primer día del mes como representante.
  const ref = new Date(year, month, 1);
  let activo: { desde: Date; planId: string | null } | null = null;
  for (const s of segmentos) {
    if (s.desde.getTime() <= ref.getTime()) activo = s;
    else break;
  }
  if (!activo?.planId) return fallbackPrecio;
  return planesById.get(activo.planId)?.precio_mensual ?? fallbackPrecio;
}

function parseDateStr(s: string): { y: number; m: number } {
  const parts = s.split("T")[0].split("-").map(Number);
  return { y: parts[0], m: parts[1] - 1 }; // m is 0-indexed
}

function monthRange(
  desde: string,
  hasta?: string
): Array<{ year: number; month: number }> {
  const start = parseDateStr(desde);
  const now = new Date();
  const end = hasta
    ? parseDateStr(hasta)
    : { y: now.getFullYear(), m: now.getMonth() };

  const result: Array<{ year: number; month: number }> = [];
  let y = start.y;
  let m = start.m;
  while (y < end.y || (y === end.y && m <= end.m)) {
    result.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

export function calcularDeudas(
  corredores: Corredor[],
  transacciones: Transaccion[],
  pausas: Pausa[] = [],
  pagosAplicados: PagoAplicado[] = [],
  cambiosPlan: CambioPlan[] = [],
  planes: Plan[] = []
): DeudaCorredor[] {
  const hoy = new Date();
  const planesById = new Map(planes.map((p) => [p.id, p]));

  return corredores
    .map(corredor => {
      const precioActual = corredor.plan?.precio_mensual ?? 0;
      const cambiosCorredor = cambiosPlan.filter((c) => c.corredor_id === corredor.id);
      const segmentos = buildPlanSegments(corredor, cambiosCorredor);

      // Fuente de verdad: pagos_aplicados (mes/año en que se aplica el pago,
      // independiente de la fecha en que se cobró). Fallback a t.fecha sólo
      // para transacciones legacy que aún no tienen filas en pagos_aplicados.
      const paDelCorredor = pagosAplicados.filter(pa => pa.corredor_id === corredor.id);
      const aplicadosSet = new Set(
        paDelCorredor.map(pa => `${pa.año}-${pa.mes - 1}`)
      );
      // Sólo excluir del fallback legacy los tx que ya tienen pa asignada AL MISMO corredor.
      // Si hay un pa huérfano/cross-corredor, no debe afectar el cálculo de este corredor.
      const txConAplicacion = new Set(paDelCorredor.map(pa => pa.transaccion_id));
      const legacyPagados = transacciones
        .filter(
          t =>
            t.corredor_id === corredor.id &&
            t.tipo === "ingreso" &&
            t.estado === "pagado" &&
            !txConAplicacion.has(t.id)
        )
        .map(t => {
          const [y, m] = t.fecha.split("T")[0].split("-").map(Number);
          return `${y}-${m - 1}`;
        });
      const pagadosSet = new Set<string>(legacyPagados);
      aplicadosSet.forEach((k) => pagadosSet.add(k));

const pausasMap = new Map(
        pausas
          .filter(p => p.corredor_id === corredor.id)
          .map(p => [`${p.año}-${p.mes - 1}`, Number(p.tarifa_mantenimiento ?? 0)])
      );

      const fechaFin = corredor.estado === "inactivo" && corredor.fecha_salida
        ? corredor.fecha_salida
        : undefined;

      const meses: MesDeuda[] = monthRange(corredor.fecha_ingreso, fechaFin).map(
        ({ year, month }) => {
          const k = `${year}-${month}`;
          const esFuturo =
            year > hoy.getFullYear() ||
            (year === hoy.getFullYear() && month > hoy.getMonth());
          const pagado = pagadosSet.has(k);
          const pausado = pausasMap.has(k);
          // Si hay pausa, el monto es la tarifa de mantenimiento. Si no, se
          // resuelve por segmento de plan vigente en ese mes (precio histórico).
          const monto = pausado
            ? pausasMap.get(k)!
            : precioEnMes(segmentos, planesById, precioActual, year, month);
          return {
            year,
            month,
            estado: esFuturo
              ? "futuro"
              : pausado
              ? "pausa"
              : pagado
              ? "pagado"
              : "deuda",
            monto,
          };
        }
      );

      const deudas = meses.filter(m => m.estado === "deuda");
      return {
        corredor,
        meses,
        totalDeuda: deudas.reduce((s, m) => s + m.monto, 0),
        mesesDeudaCount: deudas.length,
      };
    })
    .sort((a, b) => b.mesesDeudaCount - a.mesesDeudaCount);
}

export const MESES_ES = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic",
];
