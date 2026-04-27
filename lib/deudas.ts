import type { Corredor, Transaccion, Pausa, PagoAplicado } from "@/types/database";

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
  pagosAplicados: PagoAplicado[] = []
): DeudaCorredor[] {
  const hoy = new Date();

  return corredores
    .map(corredor => {
      const precio = corredor.plan?.precio_mensual ?? 0;

      // Fuente de verdad: pagos_aplicados (mes/año en que se aplica el pago,
      // independiente de la fecha en que se cobró). Fallback a t.fecha sólo
      // para transacciones legacy que aún no tienen filas en pagos_aplicados.
      const aplicadosSet = new Set(
        pagosAplicados
          .filter(pa => pa.corredor_id === corredor.id)
          .map(pa => `${pa.año}-${pa.mes - 1}`)
      );
      const txConAplicacion = new Set(pagosAplicados.map(pa => pa.transaccion_id));
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

      const pausasSet = new Set(
        pausas
          .filter(p => p.corredor_id === corredor.id)
          .map(p => `${p.año}-${p.mes - 1}`)
      );

      const fechaFin = corredor.estado === "inactivo" && corredor.fecha_salida
        ? corredor.fecha_salida
        : undefined;

      const meses: MesDeuda[] = monthRange(corredor.fecha_ingreso, fechaFin).map(
        ({ year, month }) => {
          const esFuturo =
            year > hoy.getFullYear() ||
            (year === hoy.getFullYear() && month > hoy.getMonth());
          const pagado = pagadosSet.has(`${year}-${month}`);
          const pausado = pausasSet.has(`${year}-${month}`);
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
            monto: precio,
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
