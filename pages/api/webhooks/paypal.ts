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
    transaction_fee?: { value?: string; currency?: string };
  };
}

const PAYPAL_MX_FEE_TAX_RATE = 0.16; // IVA México sobre comisión PayPal

async function verifyPayPalWebhook(
  req: NextApiRequest,
  body: PayPalWebhookBody,
  webhookId: string
): Promise<boolean> {
  const transmissionId = req.headers["paypal-transmission-id"];
  if (!transmissionId) {
    console.error(
      "Webhook PayPal recibido sin headers de transmisión (paypal-transmission-id)"
    );
    return false;
  }

  try {
    const response = await paypalFetch(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: req.headers["paypal-auth-algo"],
          cert_url: req.headers["paypal-cert-url"],
          transmission_id: transmissionId,
          transmission_sig: req.headers["paypal-transmission-sig"],
          transmission_time: req.headers["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: body,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `Verificación PayPal falló: HTTP ${response.status}`,
        text.slice(0, 500)
      );
      return false;
    }
    const result = (await response.json()) as { verification_status?: string };
    if (result.verification_status !== "SUCCESS") {
      console.error(
        `Verificación PayPal devolvió ${result.verification_status} para transmission ${String(transmissionId)}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "Error verificando firma PayPal:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error(
      "PAYPAL_WEBHOOK_ID no está configurado. Los webhooks no se pueden verificar."
    );
    return res.status(500).json({ error: "Webhook no configurado" });
  }

  const body = req.body as PayPalWebhookBody;
  if (!body || typeof body !== "object" || !body.event_type) {
    console.error("Webhook PayPal con cuerpo inválido o vacío");
    return res.status(400).json({ error: "Cuerpo inválido" });
  }

  const isValid = await verifyPayPalWebhook(req, body, webhookId);

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

      const filters = [
        payerId ? `paypal_payer_id.eq.${payerId}` : null,
        subscriptionId ? `paypal_subscription_id.eq.${subscriptionId}` : null,
      ].filter((f): f is string => f !== null).join(",");

      let corredor: { id: string } | null = null;
      if (filters) {
        const { data, error: lookupErr } = await supabase
          .from("corredores")
          .select("id")
          .or(filters)
          .single();
        if (lookupErr && lookupErr.code !== "PGRST116") throw new Error(lookupErr.message);
        corredor = data;
      }

      const feeBruto = Number(resource.transaction_fee?.value ?? 0);
      // PayPal MX no desglosa IVA del fee; estimamos: fee_neto = bruto / 1.16
      const feeNeto = feeBruto > 0 ? feeBruto / (1 + PAYPAL_MX_FEE_TAX_RATE) : 0;
      const feeTax = feeBruto - feeNeto;

      if (corredor) {
        const { data: txRow, error: upsertErr } = await supabase
          .from("transacciones")
          .upsert(
            {
              tipo: "ingreso",
              descripcion: `Pago PayPal — venta ${saleId}`,
              monto,
              comision: feeNeto,
              comision_impuesto: feeTax,
              fecha: new Date().toISOString().split("T")[0],
              categoria: "membresia",
              metodo: "paypal",
              estado: "pagado",
              corredor_id: corredor.id,
              paypal_order_id: saleId,
            },
            { onConflict: "paypal_order_id" }
          )
          .select("id")
          .single();
        if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);

        if (txRow?.id) {
          const { error: rpcErr } = await supabase.rpc("aplicar_pago", {
            p_transaccion_id: txRow.id,
            p_corredor_id: corredor.id,
            p_monto: monto,
            p_mes_override: null,
            p_anio_override: null,
          });
          if (rpcErr) console.error("aplicar_pago PayPal error:", rpcErr.message);
        }
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

      const { data: corredor, error: lookupErr } = await supabase
        .from("corredores")
        .select("id")
        .eq("paypal_subscription_id", subscriptionId)
        .single();
      if (lookupErr && lookupErr.code !== "PGRST116") throw new Error(lookupErr.message);

      if (corredor) {
        const { error: upsertErr } = await supabase.from("transacciones").upsert(
          {
            tipo: "ingreso",
            descripcion: `Pago fallido PayPal — suscripción ${subscriptionId}`,
            monto: Number(resource.amount?.total ?? 0),
            fecha: new Date().toISOString().split("T")[0],
            categoria: "membresia",
            metodo: "paypal",
            estado: "vencido",
            corredor_id: corredor.id,
            paypal_order_id: body.id ?? `failed_${subscriptionId}`,
          },
          { onConflict: "paypal_order_id" }
        );
        if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);
      }
    }

    if (body.event_type === "PAYMENT.SALE.REVERSED") {
      const saleId = body.resource.id;
      await supabase
        .from("transacciones")
        .update({ estado: "reembolsado" })
        .eq("paypal_order_id", saleId);
    }
  } catch (err) {
    console.error(
      `Error procesando webhook PayPal ${body.event_type} (id=${body.id ?? "?"}):`,
      err instanceof Error ? err.message : err
    );
    return res.status(500).json({ error: "Error interno" });
  }

  return res.status(200).json({ received: true });
}
