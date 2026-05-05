import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";

// Fetches fee breakdown for an invoice charge
async function resolveChargeId(invoice: Stripe.Invoice): Promise<string | null> {
  const inv = invoice as unknown as {
    id?: string;
    charge?: string | { id?: string };
    payment_intent?: string | { id?: string };
  };
  if (inv.charge) return typeof inv.charge === "string" ? inv.charge : inv.charge.id ?? null;

  let piId: string | null = null;
  if (inv.payment_intent) {
    piId = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent.id ?? null;
  }

  if (!piId && inv.id) {
    try {
      const full = await stripe.invoices.retrieve(inv.id, {
        expand: ["payments.data.payment.payment_intent", "payments.data.payment.charge"],
      });
      const payments = (full as unknown as {
        payments?: { data?: Array<{ payment?: { payment_intent?: string | { id?: string }; charge?: string | { id?: string } } }> };
      }).payments;
      const first = payments?.data?.[0]?.payment;
      if (first?.charge) return typeof first.charge === "string" ? first.charge : first.charge.id ?? null;
      if (first?.payment_intent) {
        piId = typeof first.payment_intent === "string" ? first.payment_intent : first.payment_intent.id ?? null;
      }
    } catch (e) {
      console.error("sync invoice.payments expand failed:", e);
    }
  }

  if (!piId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    const lc = pi.latest_charge as Stripe.Charge | string | null;
    return (typeof lc === "string" ? lc : lc?.id) ?? null;
  } catch {
    return null;
  }
}

async function fetchFees(invoice: Stripe.Invoice): Promise<{ fee: number; tax: number }> {
  const chargeId = await resolveChargeId(invoice);
  if (!chargeId) return { fee: 0, tax: 0 };
  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ["balance_transaction"],
    });
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    if (!bt) return { fee: 0, tax: 0 };
    const fee = (bt.fee ?? 0) / 100;
    const taxAmount = (bt.fee_details ?? [])
      .filter((f) => f.type === "tax")
      .reduce((s, f) => s + (f.amount ?? 0), 0) / 100;
    return { fee: fee - taxAmount, tax: taxAmount };
  } catch {
    return { fee: 0, tax: 0 };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // Optional: days to look back (default 30)
  const days = Math.min(Number((req.query.days as string) ?? "30"), 365);
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const supabase = createServerClient();
  const stats = { synced: 0, sin_asignar: 0, skipped: 0, errors: 0 };

  try {
    // Paginate through all paid invoices since `since`
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: Stripe.InvoiceListParams = {
        status: "paid",
        created: { gte: since },
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      };

      const invoices = await stripe.invoices.list(params);
      hasMore = invoices.has_more;
      if (invoices.data.length > 0) {
        startingAfter = invoices.data[invoices.data.length - 1].id;
      }

      for (const invoice of invoices.data) {
        try {
          const monto = (invoice.amount_paid ?? 0) / 100;
          if (monto <= 0) { stats.skipped++; continue; }

          const fecha = new Date((invoice.created ?? Date.now() / 1000) * 1000)
            .toISOString()
            .split("T")[0];

          const customerId = invoice.customer as string | null;
          const inv = invoice as unknown as { subscription?: string | { id?: string } };
          const subscriptionId = typeof inv.subscription === "string" ? inv.subscription : (inv.subscription as { id?: string } | null)?.id ?? null;
          const customerEmail = invoice.customer_email ?? null;

          // 1. Match by stripe_customer_id
          let corredor: { id: string } | null = null;
          if (customerId) {
            const { data } = await supabase.from("corredores").select("id").eq("stripe_customer_id", customerId).maybeSingle();
            corredor = data;
          }
          // 2. Match by stripe_subscription_id
          if (!corredor && subscriptionId) {
            const { data } = await supabase.from("corredores").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
            corredor = data;
            if (corredor && customerId) {
              await supabase.from("corredores").update({ stripe_customer_id: customerId }).eq("id", corredor.id);
            }
          }
          // 3. Match by email in corredor_emails
          if (!corredor && customerEmail) {
            const { data: emailRow } = await supabase.from("corredor_emails").select("corredor_id").eq("email", customerEmail).maybeSingle();
            if (emailRow) {
              corredor = { id: emailRow.corredor_id };
              const update: Record<string, string> = {};
              if (customerId) update.stripe_customer_id = customerId;
              if (subscriptionId) update.stripe_subscription_id = subscriptionId;
              if (Object.keys(update).length) await supabase.from("corredores").update(update).eq("id", corredor.id);
            }
          }

          if (corredor) {
            const { fee, tax } = await fetchFees(invoice);

            // Detectar si la transacción ya existía ANTES del upsert.
            // Si NO existía → es un pago nuevo → aplicarlo al adeudo más antiguo.
            // Si ya existía → es re-sync histórico → NO tocar pagos_aplicados.
            const { data: prev } = await supabase
              .from("transacciones")
              .select("id")
              .eq("stripe_payment_id", invoice.id)
              .maybeSingle();
            const esNueva = !prev;

            const { data: txRow, error: upsertErr } = await supabase
              .from("transacciones")
              .upsert(
                {
                  tipo: "ingreso",
                  descripcion: `Pago Stripe — factura ${invoice.id}`,
                  monto,
                  comision: fee,
                  comision_impuesto: tax,
                  fecha,
                  categoria: "membresia",
                  metodo: "stripe",
                  estado: "pagado",
                  corredor_id: corredor.id,
                  stripe_payment_id: invoice.id,
                },
                { onConflict: "stripe_payment_id" }
              )
              .select("id")
              .single();

            if (upsertErr) {
              console.error("sync/stripe upsert error:", upsertErr.message);
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
                if (rpcErr) console.error("sync/stripe aplicar_pago error:", rpcErr.message);
              }
            }
          } else {
            // Try to upsert into pagos_sin_asignar (idempotent via payload check)
            const { data: existing } = await supabase
              .from("pagos_sin_asignar")
              .select("id")
              .eq("fuente", "stripe")
              .contains("payload", { id: invoice.id })
              .maybeSingle();

            if (!existing) {
              await supabase.from("pagos_sin_asignar").insert({
                fuente: "stripe",
                payload: invoice as unknown as Record<string, unknown>,
                monto,
                fecha,
              });
            }
            stats.sin_asignar++;
          }
        } catch (err) {
          console.error("sync/stripe invoice error:", err);
          stats.errors++;
        }
      }
    }

    return res.status(200).json({ ok: true, days, stats });
  } catch (err) {
    console.error("sync/stripe fatal:", err);
    return res.status(500).json({ error: "Error al sincronizar desde Stripe" });
  }
}
