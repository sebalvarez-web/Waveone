import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase-server";

/**
 * POST /api/admin/fix-pagos-baja
 *
 * Elimina pagos_aplicados asignados a meses POSTERIORES a fecha_salida del corredor.
 * Pasa ?dry=true para solo ver qué se borraría sin hacer cambios.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const dry = req.query.dry === "true";
  const supabase = createServerClient();

  // 1. Traer corredores con fecha de baja
  const { data: corredores, error: corrErr } = await supabase
    .from("corredores")
    .select("id, nombre, fecha_salida")
    .not("fecha_salida", "is", null);

  if (corrErr) return res.status(500).json({ error: corrErr.message });

  const resumen: {
    corredor_id: string;
    nombre: string;
    fecha_salida: string;
    pagos_eliminados: { id: string; año: number; mes: number; monto: number }[];
  }[] = [];

  for (const c of corredores ?? []) {
    const salida = new Date(c.fecha_salida as string);
    const añoSalida = salida.getFullYear();
    const mesSalida = salida.getMonth() + 1; // 1-based

    // 2. Buscar pagos_aplicados posteriores a fecha_salida
    const { data: pagos, error: pagosErr } = await supabase
      .from("pagos_aplicados")
      .select("id, año, mes, monto")
      .eq("corredor_id", c.id)
      .or(
        `año.gt.${añoSalida},and(año.eq.${añoSalida},mes.gt.${mesSalida})`
      ) as unknown as { data: { id: string; año: number; mes: number; monto: number }[] | null; error: { message: string } | null };

    if (pagosErr) {
      console.error(`pagos_aplicados fetch error corredor ${c.id}:`, pagosErr.message);
      continue;
    }

    if (!pagos || pagos.length === 0) continue;

    resumen.push({
      corredor_id: c.id,
      nombre: c.nombre,
      fecha_salida: c.fecha_salida as string,
      pagos_eliminados: pagos,
    });

    if (!dry) {
      const ids = pagos.map((p) => p.id);
      const { error: delErr } = await supabase
        .from("pagos_aplicados")
        .delete()
        .in("id", ids);

      if (delErr) {
        console.error(`delete pagos_aplicados error corredor ${c.id}:`, delErr.message);
      }
    }
  }

  const totalPagos = resumen.reduce((s, r) => s + r.pagos_eliminados.length, 0);
  const totalMonto = resumen.reduce(
    (s, r) => s + r.pagos_eliminados.reduce((ss, p) => ss + Number(p.monto), 0),
    0
  );

  return res.status(200).json({
    dry,
    corredores_afectados: resumen.length,
    pagos_aplicados_eliminados: totalPagos,
    monto_total: totalMonto,
    detalle: resumen,
  });
}
