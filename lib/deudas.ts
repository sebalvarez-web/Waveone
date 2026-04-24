import type { Corredor, Transaccion } from "@/types/database";

export type MesEstado = "pagado" | "deuda" | "futuro";

export interface MesDeuda {
  year: number;
  month: number; // 0-indexed
  estado: MesEstado;
  monto: number; // precio_mensual del plan (0 si sin plan)
}

export interface DeudaCorredor {
  corredor: Corredor;
  meses: MesDeuda[];
  totalDeuda: number;
  mesesDeudaCount: number;
}

/** Months from fecha_ingreso up to current month (inclusive) */
function monthRange(desde: string): Array<{ year: number; month: number }> {
  const inicio = new Date(desde);
  const hoy = new Date();
  const result: Array<{ year: number; month: number }> = [];
  let y = inicio.getFullYear();
  let m = inicio.getMonth();
  while (y < hoy.getFullYear() || (y === hoy.getFullYear() && m <= hoy.getMonth())) {
    result.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

export function calcularDeudas(
  corredores: Corredor[],
  transacciones: Transaccion[]
): DeudaCorredor[] {
  const hoy = new Date();

  return corredores
    .filter(c => c.estado !== "inactivo")
    .map(corredor => {
      const precio = corredor.plan?.precio_mensual ?? 0;
      const ingresos = transacciones.filter(
        t => t.corredor_id === corredor.id && t.tipo === "ingreso" && t.estado === "pagado"
      );

      // Set of "year-month" keys that have a payment
      const pagadosSet = new Set(
        ingresos.map(t => {
          const d = new Date(t.fecha);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
      );

      const meses: MesDeuda[] = monthRange(corredor.fecha_ingreso).map(({ year, month }) => {
        const esFuturo =
          year > hoy.getFullYear() ||
          (year === hoy.getFullYear() && month > hoy.getMonth());
        const pagado = pagadosSet.has(`${year}-${month}`);
        return {
          year,
          month,
          estado: esFuturo ? "futuro" : pagado ? "pagado" : "deuda",
          monto: precio,
        };
      });

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
