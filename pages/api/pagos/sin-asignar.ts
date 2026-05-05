import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { createServerClient } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

const PAYPAL_MX_FEE_TAX_RATE = 0.16;

async function fetchStripeFees(invoice: Record<string, unknown>): Promise<{ fee: number; tax: number }> {
  try {
    let chargeId = (invoice.charge as string | null) ?? null;

    // Modern Stripe invoices: charge is on the payment_intent, not the invoice directly
    if (!chargeId) {
      const piId = (invoice.payment_intent as string | null) ?? null;
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
        const lc = pi.latest_charge as Stripe.Charge | null;
        chargeId = (typeof lc === "string" ? lc : lc?.id) ?? null;
      }
    }

    if (!chargeId) return { fee: 0, tax: 0 };

    const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    if (!bt) return { fee: 0, tax: 0 };

    const fee = (bt.fee ?? 0) / 100;
    const taxAmount = (bt.fee_details ?? [])
      .filter(f => f.type === "tax")
      .reduce((s, f) => s + (f.amount ?? 0), 0);
    return { fee: fee - taxAmount / 100, tax: taxAmount / 100 };
  } catch (e) {
    console.error("[fetchStripeFees] error:", e);
    return { fee: 0, tax: 0 };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerClient();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("pagos_sin_asignar")
      .select("*")
      .eq("resuelto", false)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Filter out withdrawal records that slipped in before the allowlist fix.
    // A record is a withdrawal if:
    // - its event code is present and does NOT start with T00, OR
    // - it has no payer (no email and no payer_id) — internal PayPal movements
    const sinRetiros = (data ?? []).filter((pago) => {
      if (pago.fuente !== "paypal") return true;
      const p = pago.payload as Record<string, unknown>;
      const resource = (p.resource as Record<string, unknown> | undefined) ?? {};
      const info = (resource.transaction_info as Record<string, unknown> | undefined) ?? {};
      const amt = (info.transaction_amount as { value?: string } | undefined)?.value;
      // Negative raw amount = business paid (gasto), not a customer payment
      if (amt && Number(amt) < 0) return false;
      const eventCode = (info.transaction_event_code as string | undefined) ?? "";
      if (eventCode && !eventCode.startsWith("T00")) return false;
      const payerInfo = (resource.payer_info as Record<string, unknown> | undefined) ?? {};
      const hasPayer = !!(p.payer_id ?? p.email ?? payerInfo.payer_id ?? payerInfo.email_address);
      if (!hasPayer && !eventCode) return false;
      return true;
    });

    return res.status(200).json(sinRetiros);
  }

  if (req.method === "DELETE") {
    // One-time cleanup: mark all withdrawal-like pagos_sin_asignar as resuelto
    const { data: pending } = await supabase
      .from("pagos_sin_asignar")
      .select("id, payload, fuente")
      .eq("resuelto", false);

    const withdrawalIds: string[] = [];
    for (const pago of pending ?? []) {
      if (pago.fuente !== "paypal") continue;
      const p = pago.payload as Record<string, unknown>;
      const resource = (p.resource as Record<string, unknown> | undefined) ?? {};
      const info = (resource.transaction_info as Record<string, unknown> | undefined) ?? {};
      const amt = (info.transaction_amount as { value?: string } | undefined)?.value;
      if (amt && Number(amt) < 0) { withdrawalIds.push(pago.id); continue; }
      const eventCode = (info.transaction_event_code as string | undefined) ?? "";
      if (eventCode && !eventCode.startsWith("T00")) { withdrawalIds.push(pago.id); continue; }
      const payerInfo = (resource.payer_info as Record<string, unknown> | undefined) ?? {};
      const hasPayer = !!(p.payer_id ?? p.email ?? payerInfo.payer_id ?? payerInfo.email_address);
      if (!hasPayer && !eventCode) withdrawalIds.push(pago.id);
    }

    if (withdrawalIds.length > 0) {
      await supabase.from("pagos_sin_asignar").update({ resuelto: true }).in("id", withdrawalIds);
    }
    return res.status(200).json({ cleaned: withdrawalIds.length });
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

    // Extract IDs from payload — supports both new flat structure and old nested structure
    const pl = pago.payload as Record<string, unknown>;

    const stripePaymentId = pago.fuente === "stripe"
      ? ((pl.id as string | null) ?? null)
      : null;

    // New format: { sale_id, ... }  /  Old format: { resource: { id } }
    const paypalOrderId = pago.fuente === "paypal"
      ? ((pl.sale_id as string | null) ?? (pl.resource as { id?: string } | undefined)?.id ?? null)
      : null;

    const descripcionExtra = (pl.nombre as string | null) ?? (pl.email as string | null) ?? null;
    const descripcion = [
      `Pago reconciliado (${pago.fuente})`,
      descripcionExtra,
      "asignado manualmente",
    ].filter(Boolean).join(" — ");

    // Calculate fees
    let comision = 0;
    let comision_impuesto = 0;

    if (pago.fuente === "stripe") {
      const fees = await fetchStripeFees(pl);
      comision = fees.fee;
      comision_impuesto = fees.tax;
    } else if (pago.fuente === "paypal") {
      type SyncTx = { transaction_info?: { fee_amount?: { value?: string } } };
      const feeBruto =
        Math.abs(Number(
          (pl.resource as SyncTx | undefined)?.transaction_info?.fee_amount?.value ??
          (pl.raw as { resource?: { transaction_fee?: { value?: string } } } | undefined)
            ?.resource?.transaction_fee?.value ??
          0
        ));
      comision = feeBruto > 0 ? feeBruto / (1 + PAYPAL_MX_FEE_TAX_RATE) : 0;
      comision_impuesto = feeBruto - comision;
    }

    const { data: txRow, error: txErr } = await supabase
      .from("transacciones")
      .insert({
        tipo: "ingreso",
        descripcion,
        monto: pago.monto,
        comision,
        comision_impuesto,
        fecha: pago.fecha,
        categoria: "membresia",
        metodo: pago.fuente,
        estado: "pagado",
        corredor_id,
        stripe_payment_id: stripePaymentId,
        paypal_order_id: paypalOrderId,
      })
      .select("id")
      .single();

    let transaccionId: string | null = txRow?.id ?? null;

    if (txErr) {
      const isDuplicate = (txErr as { code?: string }).code === "23505";
      if (!isDuplicate) {
        return res.status(500).json({ error: "Error al registrar la transacción" });
      }
      // Duplicate: recuperar id existente para poder aplicar el pago al adeudo más antiguo.
      if (stripePaymentId) {
        const { data: existing } = await supabase
          .from("transacciones")
          .select("id")
          .eq("stripe_payment_id", stripePaymentId)
          .maybeSingle();
        transaccionId = existing?.id ?? null;
      } else if (paypalOrderId) {
        const { data: existing } = await supabase
          .from("transacciones")
          .select("id")
          .eq("paypal_order_id", paypalOrderId)
          .maybeSingle();
        transaccionId = existing?.id ?? null;
      }
    }

    // Aplicar el pago al/los mes(es) de adeudo más antiguo(s) del corredor.
    if (transaccionId) {
      const { count: yaAplicado } = await supabase
        .from("pagos_aplicados")
        .select("id", { count: "exact", head: true })
        .eq("transaccion_id", transaccionId);
      if ((yaAplicado ?? 0) === 0) {
        const { error: rpcErr } = await supabase.rpc("aplicar_pago", {
          p_transaccion_id: transaccionId,
          p_corredor_id: corredor_id,
          p_monto: pago.monto,
          p_mes_override: null,
          p_anio_override: null,
        });
        if (rpcErr) console.error("aplicar_pago sin-asignar error:", rpcErr.message);
      }
    }

    // Save payment IDs + email to corredor profile for future auto-assignment
    let emailFromPayment: string | null = null;

    if (pago.fuente === "stripe") {
      const customer = (pl.customer as string | null) ?? null;
      emailFromPayment = (pl.customer_email as string | null) ?? null;
      if (customer) {
        await supabase.from("corredores").update({ stripe_customer_id: customer }).eq("id", corredor_id);
      }
    } else if (pago.fuente === "paypal") {
      // Two payload shapes:
      // webhook (new): { sale_id, payer_id, subscription_id, email, nombre, raw }
      // sync:          { resource: { id, transaction_info: { paypal_reference_id, paypal_reference_id_type }, payer_info: { payer_id, email_address } } }
      type SyncResource = {
        payer_info?: { payer_id?: string; account_id?: string; email_address?: string };
        transaction_info?: { paypal_reference_id?: string; paypal_reference_id_type?: string };
      };
      const syncResource = (pl.resource as SyncResource | undefined) ?? null;

      // PayPal Transaction API uses `account_id`; webhook uses `payer_id`
      const payerId =
        (pl.payer_id as string | null) ??
        syncResource?.payer_info?.payer_id ??
        syncResource?.payer_info?.account_id ??
        null;
      // Reference type "SUB" (Subscriptions API v2) or "RP" (legacy Recurring Profile) = subscription
      const refType = syncResource?.transaction_info?.paypal_reference_id_type;
      const subscriptionId =
        (pl.subscription_id as string | null) ??
        ((refType === "SUB" || refType === "RP")
          ? syncResource?.transaction_info?.paypal_reference_id ?? null
          : null);
      emailFromPayment =
        (pl.email as string | null) ??
        syncResource?.payer_info?.email_address ??
        null;

      console.log("[sin-asignar] PayPal payload keys:", Object.keys(pl));
      console.log("[sin-asignar] payerId:", payerId, "subscriptionId:", subscriptionId, "email:", emailFromPayment);
      console.log("[sin-asignar] syncResource:", JSON.stringify(syncResource)?.slice(0, 300));

      const updates: Record<string, string> = {};
      if (payerId) updates.paypal_payer_id = payerId;
      if (subscriptionId) updates.paypal_subscription_id = subscriptionId;

      if (Object.keys(updates).length > 0) {
        const { error: ppErr } = await supabase.from("corredores").update(updates).eq("id", corredor_id);
        if (ppErr) console.error("No se pudo actualizar IDs PayPal del corredor:", ppErr.message);
        else console.log("[sin-asignar] corredor actualizado con:", updates);
      } else {
        console.warn("[sin-asignar] No se encontró payerId ni subscriptionId en el payload");
      }
    }

    // Save payment email to corredor_emails (avoid duplicates)
    if (emailFromPayment) {
      const { data: existingEmail } = await supabase
        .from("corredor_emails")
        .select("id")
        .eq("corredor_id", corredor_id)
        .eq("email", emailFromPayment)
        .maybeSingle();

      if (!existingEmail) {
        const { error: emailErr } = await supabase.from("corredor_emails").insert({
          corredor_id,
          email: emailFromPayment,
          etiqueta: pago.fuente,
          es_principal: false,
        });
        if (emailErr) console.error("No se pudo guardar email del corredor:", emailErr.message);
        else console.log(`[sin-asignar] email ${emailFromPayment} guardado para corredor ${corredor_id}`);
      }
    }

    const { error: resolveErr } = await supabase
      .from("pagos_sin_asignar")
      .update({ resuelto: true })
      .eq("id", pago_id);

    if (resolveErr) {
      console.error("Error al marcar pago como resuelto:", resolveErr);
    }

    return res.status(200).json({ ok: true, _debug: { paypalOrderId, stripePaymentId, emailFromPayment, payloadKeys: Object.keys(pl) } });
  }

  return res.status(405).json({ error: "Método no permitido" });
}
