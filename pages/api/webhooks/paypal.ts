import type { NextApiRequest, NextApiResponse } from "next";
import { paypalFetch } from "@/lib/paypal";
import { createServerClient } from "@/lib/supabase-server";

interface PayPalWebhookBody {
  event_type: string;
  id?: string;
  resource: {
    id: string;
    billing_agreement_id?: string;
    payer?: { payer_info?: { payer_id?: string } };
    amount?: { total?: string; currency?: string };
  };
}

async function verifyPayPalWebhook(
  req: NextApiRequest,
  body: PayPalWebhookBody
): Promise<boolean> {
  try {
    const response = await paypalFetch(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: req.headers["paypal-auth-algo"],
          cert_url: req.headers["paypal-cert-url"],
          transmission_id: req.headers["paypal-transmission-id"],
          transmission_sig: req.headers["paypal-transmission-sig"],
          transmission_time: req.headers["paypal-transmission-time"],
          webhook_id: process.env.PAYPAL_WEBHOOK_ID,
          webhook_event: body,
        }),
      }
    );

    if (!response.ok) return false;
    const result = await response.json();
    return result.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const body = req.body as PayPalWebhookBody;
  const isValid = await verifyPayPalWebhook(req, body);

  if (!isValid) {
    return res.status(400).json({ error: "Firma inválida" });
  }

  const supabase = createServerClient();

  try {
    if (body.event_type === "PAYMENT.SALE.COMPLETED") {
      const { resource } = body;
      const payerId = resource.payer?.payer_info?.payer_id;
      const subscriptionId = resource.billing_agreement_id;
      const saleId = resource.id;
      const monto = Number(resource.amount?.total ?? 0);

      const { data: corredor } = await supabase
        .from("corredores")
        .select("id")
        .or(`paypal_payer_id.eq.${payerId},paypal_subscription_id.eq.${subscriptionId}`)
        .single();

      if (corredor) {
        const { error: upsertErr } = await supabase.from("transacciones").upsert(
          {
            tipo: "ingreso",
            descripcion: `Pago PayPal — venta ${saleId}`,
            monto,
            fecha: new Date().toISOString().split("T")[0],
            categoria: "membresia",
            metodo: "paypal",
            estado: "pagado",
            corredor_id: corredor.id,
            paypal_order_id: saleId,
          },
          { onConflict: "paypal_order_id" }
        );
        if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);
      } else {
        const { error: insertErr } = await supabase.from("pagos_sin_asignar").insert({
          fuente: "paypal",
          payload: body as unknown as Record<string, unknown>,
          monto,
          fecha: new Date().toISOString().split("T")[0],
        });
        if (insertErr) throw new Error(`DB error: ${insertErr.message}`);
      }
    }

    if (body.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
      const { resource } = body;
      const subscriptionId = resource.id;

      const { data: corredor } = await supabase
        .from("corredores")
        .select("id")
        .eq("paypal_subscription_id", subscriptionId)
        .single();

      if (corredor) {
        const { error: upsertErr } = await supabase.from("transacciones").upsert(
          {
            tipo: "ingreso",
            descripcion: `Pago fallido PayPal — suscripción ${subscriptionId}`,
            monto: 0,
            fecha: new Date().toISOString().split("T")[0],
            categoria: "membresia",
            metodo: "paypal",
            estado: "vencido",
            corredor_id: corredor.id,
            paypal_order_id: `failed_${subscriptionId}_${Date.now()}`,
          },
          { onConflict: "paypal_order_id" }
        );
        if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);
      }
    }
  } catch (err) {
    console.error("Error procesando webhook PayPal:", err);
    return res.status(500).json({ error: "Error interno" });
  }

  return res.status(200).json({ received: true });
}
