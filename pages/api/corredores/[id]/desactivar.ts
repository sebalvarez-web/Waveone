import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { id } = req.query as { id: string };
  const supabase = createServerClient();
  const hoy = new Date().toISOString().split("T")[0];

  const { data: corredor, error: fetchErr } = await supabase
    .from("corredores")
    .select("*, plan:planes(precio_mensual)")
    .eq("id", id)
    .single();

  if (fetchErr || !corredor) {
    return res.status(404).json({ error: "Corredor no encontrado" });
  }

  const { data: transacciones } = await supabase
    .from("transacciones")
    .select("fecha")
    .eq("corredor_id", id)
    .eq("tipo", "ingreso")
    .eq("estado", "pagado");

  const pagadosSet = new Set(
    (transacciones ?? []).map((t) => {
      const d = new Date(t.fecha);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  );

  const { data: pausas } = await supabase
    .from("pausas")
    .select("mes, año")
    .eq("corredor_id", id);

  const pausasSet = new Set(
    ((pausas ?? []) as unknown as { mes: number; año: number }[]).map((p) => `${p.año}-${p.mes - 1}`)
  );

  const inicio = new Date(corredor.fecha_ingreso);
  const fin = new Date();
  const precio = corredor.plan?.precio_mensual ?? 0;
  const mesesDeuda: { fecha: string; monto: number }[] = [];

  let y = inicio.getFullYear();
  let m = inicio.getMonth();
  while (y < fin.getFullYear() || (y === fin.getFullYear() && m <= fin.getMonth())) {
    const key = `${y}-${m}`;
    if (!pagadosSet.has(key) && !pausasSet.has(key)) {
      const fecha = new Date(y, m, 1).toISOString().split("T")[0];
      mesesDeuda.push({ fecha, monto: precio });
    }
    m++;
    if (m > 11) { m = 0; y++; }
  }

  if (mesesDeuda.length > 0) {
    const registros = mesesDeuda.map(({ fecha, monto }) => ({
      tipo: "ingreso",
      descripcion: `Deuda pendiente — mes ${fecha.slice(0, 7)}`,
      monto,
      fecha,
      categoria: "membresia",
      metodo: "transferencia",
      estado: "pendiente",
      corredor_id: id,
      stripe_payment_id: null,
      paypal_order_id: null,
    }));

    const { error: insertErr } = await supabase
      .from("transacciones")
      .upsert(registros, { onConflict: "corredor_id,fecha" });

    if (insertErr) {
      return res.status(500).json({ error: insertErr.message });
    }
  }

  const { error: updateErr } = await supabase
    .from("corredores")
    .update({ estado: "inactivo", fecha_salida: hoy })
    .eq("id", id);

  if (updateErr) {
    return res.status(500).json({ error: updateErr.message });
  }

  return res.status(200).json({ ok: true, deudasRegistradas: mesesDeuda.length });
}
