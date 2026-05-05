import type { NextApiRequest, NextApiResponse } from "next";
import { paypalFetch } from "@/lib/paypal";
import { createServerClient } from "@/lib/supabase-server";

const PAYPAL_MX_FEE_TAX_RATE = 0.16;

// ALLOWLIST: only T00xx codes are real customer payments.
// T01xx=disbursements, T02xx=withdrawals, T03xx=funding, T04xx=fees,
// T05xx=reversals, T06xx-T22xx=internal/administrative/misc.
// If event code is absent we fall through to payer_info check as last resort.
function isCustomerPayment(eventCode: string): boolean {
  if (!eventCode) return true; // unknown — let payer_info check decide
  return eventCode.startsWith("T00");
}

interface PayPalTransaction {
  transaction_info: {
    transaction_id: string;
    transaction_amount: { value: string; currency_code: string };
    fee_amount?: { value: string };
    transaction_initiation_date: string;
    transaction_status: string;
    transaction_event_code?: string;  // e.g. T0006 = payment, T0200 = withdrawal
    transaction_subject?: string;
    transaction_note?: string;
    paypal_reference_id?: string;
    paypal_reference_id_type?: string;
  };
  payer_info?: {
    payer_id?: string;
    account_id?: string;  // PayPal Transaction API returns account_id, not payer_id
    email_address?: string;
    payer_name?: { given_name?: string; surname?: string; alternate_full_name?: string };
  };
}

interface PayPalTransactionResponse {
  transaction_details?: PayPalTransaction[];
  total_pages?: number;
  page?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const daysRequested = Math.min(Number((req.query.days as string) ?? "30"), 365);
  // PayPal Transaction Search API max range = 31 days per request — split into chunks
  const PAYPAL_MAX_DAYS = 31;
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "+0000");

  const supabase = createServerClient();
  const stats = { synced: 0, sin_asignar: 0, skipped: 0, errors: 0, total_found: 0 };
  const debug: string[] = [];

  // Build date windows of ≤31 days covering the full requested range
  const windows: { start: Date; end: Date }[] = [];
  let windowEnd = new Date();
  let remaining = daysRequested;
  while (remaining > 0) {
    const chunkDays = Math.min(remaining, PAYPAL_MAX_DAYS);
    const windowStart = new Date(windowEnd.getTime() - chunkDays * 86400 * 1000);
    windows.unshift({ start: windowStart, end: new Date(windowEnd) });
    windowEnd = windowStart;
    remaining -= chunkDays;
  }

  try {
    for (const window of windows) {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const params = new URLSearchParams({
        start_date: fmt(window.start),
        end_date: fmt(window.end),
        transaction_status: "S", // "S" = Success/Completed
        page_size: "100",
        page: String(page),
        fields: "transaction_info,payer_info,cart_info",
      });

      const resp = await paypalFetch(`/v1/reporting/transactions?${params.toString()}`);

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error("PayPal transactions API error:", errBody);
        return res.status(500).json({ error: "Error consultando PayPal Transaction API", detail: errBody });
      }

      const data: PayPalTransactionResponse = await resp.json();
      totalPages = data.total_pages ?? 1;
      const transactions = data.transaction_details ?? [];
      stats.total_found += transactions.length;
      debug.push(`página ${page}/${totalPages}: ${transactions.length} transacciones`);

      for (const tx of transactions) {
        try {
          const info = tx.transaction_info;
          const rawAmount = Number(info.transaction_amount?.value ?? 0);
          const eventCodeRaw = info.transaction_event_code ?? "";

          // Refunds: T11xx (refunds) and T17xx (reversals). Mark original tx as reembolsado.
          const isRefund = eventCodeRaw.startsWith("T11") || eventCodeRaw.startsWith("T17") ||
            (rawAmount < 0 && info.paypal_reference_id);
          if (isRefund) {
            const originalSaleId = info.paypal_reference_id;
            if (originalSaleId) {
              const { error: refundErr } = await supabase
                .from("transacciones")
                .update({ estado: "reembolsado" })
                .eq("paypal_order_id", originalSaleId);
              if (refundErr) {
                console.error("sync/paypal refund update error:", refundErr.message);
                stats.errors++;
              } else {
                debug.push(`refund applied to ${originalSaleId} (event=${eventCodeRaw}, amount=${rawAmount})`);
              }
            } else {
              debug.push(`skip refund without reference: ${info.transaction_id}`);
            }
            stats.skipped++; continue;
          }

          // Skip non-positive amounts — withdrawals are negative
          if (rawAmount <= 0) {
            debug.push(`skip amount<=0 (${rawAmount}): ${info.transaction_id}`);
            stats.skipped++; continue;
          }

          const monto = rawAmount;

          if (info.transaction_status !== "S") {
            debug.push(`skip status=${info.transaction_status}: ${info.transaction_id}`);
            stats.skipped++; continue;
          }

          // Allowlist: only T00xx are real customer payments; skip all else
          const eventCode = eventCodeRaw;
          if (!isCustomerPayment(eventCode)) {
            debug.push(`skip non-payment event_code=${eventCode}: ${info.transaction_id}`);
            stats.skipped++; continue;
          }

          // Last resort for unknown event code: require a payer
          if (!eventCode && !tx.payer_info?.payer_id && !tx.payer_info?.email_address) {
            debug.push(`skip no-payer no-eventcode: ${info.transaction_id}`);
            stats.skipped++; continue;
          }

          const fecha = info.transaction_initiation_date
            ? info.transaction_initiation_date.split("T")[0]
            : new Date().toISOString().split("T")[0];

          const payerId = tx.payer_info?.payer_id ?? tx.payer_info?.account_id ?? null;
          const payerEmail = tx.payer_info?.email_address ?? null;
          const refType = info.paypal_reference_id_type;
          const subscriptionId =
            (refType === "SUB" || refType === "RP") ? info.paypal_reference_id ?? null : null;
          const saleId = info.transaction_id;

          // 1. Match by paypal_payer_id or paypal_subscription_id
          const filters = [
            payerId ? `paypal_payer_id.eq.${payerId}` : null,
            subscriptionId ? `paypal_subscription_id.eq.${subscriptionId}` : null,
          ].filter((f): f is string => f !== null).join(",");

          let corredor: { id: string } | null = null;
          if (filters) {
            const { data: found } = await supabase
              .from("corredores")
              .select("id")
              .or(filters)
              .maybeSingle();
            corredor = found;
          }
          // 2. Fallback: match by email in corredor_emails
          if (!corredor && payerEmail) {
            const { data: emailRow } = await supabase
              .from("corredor_emails")
              .select("corredor_id")
              .eq("email", payerEmail)
              .maybeSingle();
            if (emailRow) {
              corredor = { id: emailRow.corredor_id };
              // Persist payer_id so future syncs match directly
              const update: Record<string, string> = {};
              if (payerId) update.paypal_payer_id = payerId;
              if (subscriptionId) update.paypal_subscription_id = subscriptionId;
              if (Object.keys(update).length) await supabase.from("corredores").update(update).eq("id", corredor.id);
            }
          }

          const feeBruto = Math.abs(Number(info.fee_amount?.value ?? 0));
          const feeNeto = feeBruto > 0 ? feeBruto / (1 + PAYPAL_MX_FEE_TAX_RATE) : 0;
          const feeTax = feeBruto - feeNeto;

          if (corredor) {
            // Detectar si la transacción ya existía ANTES del upsert.
            // Si NO existía → es un pago nuevo → aplicarlo al adeudo más antiguo.
            // Si ya existía → es re-sync histórico → NO tocar pagos_aplicados.
            const { data: prev } = await supabase
              .from("transacciones")
              .select("id")
              .eq("paypal_order_id", saleId)
              .maybeSingle();
            const esNueva = !prev;

            const { data: txRow, error: upsertErr } = await supabase
              .from("transacciones")
              .upsert(
                {
                  tipo: "ingreso",
                  descripcion: `Pago PayPal — venta ${saleId}`,
                  monto,
                  comision: feeNeto,
                  comision_impuesto: feeTax,
                  fecha,
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

            if (upsertErr) {
              console.error("sync/paypal upsert error:", upsertErr.message);
              stats.errors++;
            } else {
              stats.synced++;
              if (esNueva && txRow?.id) {
                const { error: rpcErr } = await supabase.rpc("aplicar_pago", {
                  p_transaccion_id: txRow.id,
                  p_corredor_id: corredor.id,
                  p_monto: monto,
                  p_mes_override: null,
                  p_anio_override: null,
                });
                if (rpcErr) console.error("sync/paypal aplicar_pago error:", rpcErr.message);
              }
            }
          } else {
            // pagos_sin_asignar — avoid duplicates
            const { data: existing } = await supabase
              .from("pagos_sin_asignar")
              .select("id")
              .eq("fuente", "paypal")
              .contains("payload", { resource: { id: saleId } })
              .maybeSingle();

            if (!existing) {
              const pn = tx.payer_info?.payer_name;
              const nombreSync =
                pn?.alternate_full_name ||
                (pn?.given_name || pn?.surname
                  ? `${pn.given_name ?? ""} ${pn.surname ?? ""}`.trim()
                  : null) ||
                null;
              await supabase.from("pagos_sin_asignar").insert({
                fuente: "paypal",
                payload: {
                  sale_id: saleId,
                  nombre: nombreSync,
                  email: payerEmail,
                  payer_id: payerId,
                  subscription_id: subscriptionId,
                  resource: { id: saleId, ...tx },
                } as unknown as Record<string, unknown>,
                monto,
                fecha,
              });
            }
            stats.sin_asignar++;
          }
        } catch (err) {
          console.error("sync/paypal tx error:", err);
          stats.errors++;
        }
      }

      page++;
    }
    } // end for window

    return res.status(200).json({ ok: true, days: daysRequested, stats, debug });
  } catch (err) {
    console.error("sync/paypal fatal:", err);
    return res.status(500).json({ error: "Error al sincronizar desde PayPal" });
  }
}
