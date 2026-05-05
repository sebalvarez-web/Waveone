import type { NextApiRequest, NextApiResponse } from "next";
import { paypalFetch } from "@/lib/paypal";
import { createServerClient } from "@/lib/supabase-server";
import { revertirPago } from "@/lib/revertir-pago";

interface PayPalWebhookBody {
  event_type: string;
  id?: string;
  resource: {
    // PAYMENT.SALE.COMPLETED (billing agreements / old API)
    id: string;
    billing_agreement_id?: string;
    payer?: { payer_info?: { payer_id?: string; email?: string; first_name?: string; last_name?: string } };
    amount?: { total?: string; currency?: string };
    transaction_fee?: { value?: string; currency?: string };
    // BILLING.SUBSCRIPTION.PAYMENT.COMPLETED (Subscriptions API v2)
    subscriber?: { payer_id?: string; email_address?: string; name?: { given_name?: string; surname?: string } };
    billing_info?: { last_payment?: { amount?: { value?: string; currency_code?: string } } };
  };
}

const PAYPAL_MX_FEE_TAX_RATE = 0.16; // IVA México sobre comisión PayPal

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

  if (!process.env.PAYPAL_WEBHOOK_ID) {
    // PAYPAL_WEBHOOK_ID not configured — log but do not reject
    console.warn("PAYPAL_WEBHOOK_ID no está configurado. Verificación de firma omitida.");
  } else {
    const isValid = await verifyPayPalWebhook(req, body);
    if (!isValid) {
      return res.status(400).json({ error: "Firma inválida" });
    }
  }

  const supabase = createServerClient();

  console.log("[paypal webhook] event_type:", body.event_type, "resource.id:", body.resource?.id);

  try {
    if (
      body.event_type === "PAYMENT.SALE.COMPLETED" ||
      body.event_type === "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED"
    ) {
      const { resource } = body;
      const isV2 = body.event_type === "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED";

      // v1: payer_id in payer.payer_info; v2: payer_id in subscriber
      const payerId = isV2
        ? resource.subscriber?.payer_id
        : resource.payer?.payer_info?.payer_id;
      // v1: billing_agreement_id; v2: resource.id is the subscription id
      const subscriptionId = isV2 ? resource.id : resource.billing_agreement_id;
      const saleId = isV2 ? (body.id ?? resource.id) : resource.id;
      // v1: amount.total; v2: billing_info.last_payment.amount.value
      const monto = isV2
        ? Number(resource.billing_info?.last_payment?.amount?.value ?? 0)
        : Number(resource.amount?.total ?? 0);

      console.log("[paypal webhook] payerId:", payerId, "subscriptionId:", subscriptionId, "monto:", monto);

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
          .maybeSingle();
        if (lookupErr && lookupErr.code !== "PGRST116") throw new Error(lookupErr.message);
        corredor = data;
      }

      console.log("[paypal webhook] corredor encontrado:", corredor?.id ?? "ninguno");

      const feeBruto = Number(resource.transaction_fee?.value ?? 0);
      const feeNeto = feeBruto > 0 ? feeBruto / (1 + PAYPAL_MX_FEE_TAX_RATE) : 0;
      const feeTax = feeBruto - feeNeto;

      const emailPagador = isV2
        ? (resource.subscriber?.email_address ?? null)
        : (resource.payer?.payer_info?.email ?? null);
      const nombrePagador = isV2 && resource.subscriber?.name
        ? `${resource.subscriber.name.given_name ?? ""} ${resource.subscriber.name.surname ?? ""}`.trim() || null
        : (resource.payer?.payer_info?.first_name || resource.payer?.payer_info?.last_name)
          ? `${resource.payer?.payer_info?.first_name ?? ""} ${resource.payer?.payer_info?.last_name ?? ""}`.trim()
          : null;
      const descParts = [
        isV2 ? "Suscripción PayPal" : "Pago PayPal",
        nombrePagador ?? emailPagador,
        `venta ${saleId}`,
      ].filter(Boolean);

      if (corredor) {
        const { data: txRow, error: upsertErr } = await supabase
          .from("transacciones")
          .upsert(
            {
              tipo: "ingreso",
              descripcion: descParts.join(" — "),
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
          const { count: yaAplicado } = await supabase
            .from("pagos_aplicados")
            .select("id", { count: "exact", head: true })
            .eq("transaccion_id", txRow.id);
          if ((yaAplicado ?? 0) === 0) {
            const { error: rpcErr } = await supabase.rpc("aplicar_pago", {
              p_transaccion_id: txRow.id,
              p_corredor_id: corredor.id,
              p_monto: monto,
              p_mes_override: null,
              p_anio_override: null,
            });
            if (rpcErr) console.error("aplicar_pago PayPal error:", rpcErr.message);
          }
        }
      } else {
        // Check duplicate before inserting
        const { data: existing } = await supabase
          .from("pagos_sin_asignar")
          .select("id")
          .eq("fuente", "paypal")
          .contains("payload", { sale_id: saleId })
          .maybeSingle();

        if (!existing) {
          const { error: insertErr } = await supabase.from("pagos_sin_asignar").insert({
            fuente: "paypal",
            payload: {
              sale_id: saleId,
              email: emailPagador,
              nombre: nombrePagador,
              subscription_id: subscriptionId,
              payer_id: payerId,
              raw: body,
            } as unknown as Record<string, unknown>,
            monto,
            fecha: new Date().toISOString().split("T")[0],
          });
          if (insertErr) throw new Error(`DB error: ${insertErr.message}`);
        }
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

    if (
      body.event_type === "PAYMENT.SALE.REVERSED" ||
      body.event_type === "PAYMENT.SALE.REFUNDED" ||
      body.event_type === "PAYMENT.CAPTURE.REFUNDED"
    ) {
      const resource = body.resource as unknown as {
        id?: string;
        sale_id?: string;
        capture_id?: string;
      };
      const saleId = resource.sale_id ?? resource.capture_id ?? resource.id;
      if (saleId) await revertirPago(supabase, { paypal_order_id: saleId });
    }
  } catch (err) {
    console.error("Error procesando webhook PayPal:", err);
    return res.status(500).json({ error: "Error interno" });
  }

  return res.status(200).json({ received: true });
}
