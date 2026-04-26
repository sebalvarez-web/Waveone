import type { Corredor, Transaccion, Pausa } from "@/types/database";

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

function monthRange(
  desde: string,
  hasta?: string
): Array<{ year: number; month: number }> {
  const inicio = new Date(desde);
  const fin = hasta ? new Date(hasta) : new Date();
  const result: Array<{ year: number; month: number }> = [];
  let y = inicio.getFullYear();
  let m = inicio.getMonth();
  while (
    y < fin.getFullYear() ||
    (y === fin.getFullYear() && m <= fin.getMonth())
  ) {
    result.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

export function calcularDeudas(
  corredores: Corredor[],
  transacciones: Transaccion[],
  pausas: Pausa[] = []
): DeudaCorredor[] {
  const hoy = new Date();

  return corredores
    .map(corredor => {
      const precio = corredor.plan?.precio_mensual ?? 0;
      const ingresos = transacciones.filter(
        t =>
          t.corredor_id === corredor.id &&
          t.tipo === "ingreso" &&
          t.estado === "pagado"
      );

      const pagadosSet = new Set(
        ingresos.map(t => {
          const d = new Date(t.fecha);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
      );

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
