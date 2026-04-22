import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@/lib/supabase-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerClient();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("pagos_sin_asignar")
      .select("*")
      .eq("resuelto", false)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { pago_id, corredor_id } = req.body as {
      pago_id: string;
      corredor_id: string;
    };

    if (typeof pago_id !== "string" || !pago_id || typeof corredor_id !== "string" || !corredor_id) {
      return res.status(400).json({ error: "pago_id y corredor_id deben ser strings no vacíos" });
    }

    const { data: pago, error: pagoErr } = await supabase
      .from("pagos_sin_asignar")
      .select("*")
      .eq("id", pago_id)
      .single();

    if (pagoErr || !pago) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const { error: txErr } = await supabase.from("transacciones").insert({
      tipo: "ingreso",
      descripcion: `Pago reconciliado (${pago.fuente}) — asignado manualmente`,
      monto: pago.monto,
      fecha: pago.fecha,
      categoria: "membresia",
      metodo: pago.fuente,
      estado: "pagado",
      corredor_id,
      stripe_payment_id: pago.fuente === "stripe" ? (pago.payload as { id?: string })?.id : null,
      paypal_order_id:
        pago.fuente === "paypal"
          ? (pago.payload as { resource?: { id?: string } })?.resource?.id
          : null,
    });

    if (txErr) {
      const isDuplicate = (txErr as { code?: string }).code === "23505";
      if (!isDuplicate) {
        return res.status(500).json({ error: "Error al registrar la transacción" });
      }
      // genuine duplicate — safe to continue
    }

    if (pago.fuente === "stripe") {
      const customer = (pago.payload as { customer?: string })?.customer;
      if (customer) {
        const { error: custUpdateErr } = await supabase
          .from("corredores")
          .update({ stripe_customer_id: customer })
          .eq("id", corredor_id);
        if (custUpdateErr) console.error("No se pudo actualizar stripe_customer_id:", custUpdateErr);
      }
    } else if (pago.fuente === "paypal") {
      const payerId = (
        pago.payload as { resource?: { payer?: { payer_info?: { payer_id?: string } } } }
      )?.resource?.payer?.payer_info?.payer_id;
      if (payerId) {
        const { error: payerUpdateErr } = await supabase
          .from("corredores")
          .update({ paypal_payer_id: payerId })
          .eq("id", corredor_id);
        if (payerUpdateErr) console.error("No se pudo actualizar paypal_payer_id:", payerUpdateErr);
      }
    }

    const { error: resolveErr } = await supabase
      .from("pagos_sin_asignar")
      .update({ resuelto: true })
      .eq("id", pago_id);

    if (resolveErr) {
      console.error("Error al marcar pago como resuelto:", resolveErr);
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
