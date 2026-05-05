import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase-server";

const ALLOWED_FIELDS = [
  "descripcion", "monto", "fecha", "categoria",
  "estado", "metodo", "comision", "comision_impuesto", "pagado_a",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return res.status(400).json({ error: "id requerido" });

  const supabase = createServerClient();

  if (req.method === "PATCH") {
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) updates[field] = body[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Sin campos para actualizar" });
    }
    const { error } = await supabase.from("transacciones").update(updates).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    // Borra primero los pagos_aplicados ligados a esta transacción para liberar
    // los meses en el calendario de deudas, luego elimina la transacción.
    const { error: paErr } = await supabase
      .from("pagos_aplicados")
      .delete()
      .eq("transaccion_id", id);
    if (paErr) return res.status(500).json({ error: paErr.message });

    const { error: txErr } = await supabase
      .from("transacciones")
      .delete()
      .eq("id", id);
    if (txErr) return res.status(500).json({ error: txErr.message });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
