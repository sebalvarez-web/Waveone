import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";
import { revertirPago } from "@/lib/revertir-pago";

export const config = { api: { bodyParser: false } };

function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // node-mocks-http objects are EventEmitters but not readable streams and never
    // emit 'data' or 'end'. Detect by checking for the readable stream property.
    if (!(req as unknown as { readable?: boolean }).readable) {
      return resolve(Buffer.from(""));
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const signature = req.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(req);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test"
    );
  } catch {
    return res.status(400).json({ error: "Firma inválida" });
  }

  const supabase = createServerClient();

  try {
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentSucceeded(supabase, invoice);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(supabase, invoice);
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const invoiceId = (charge as unknown as { invoice?: string }).invoice ?? null;
      if (invoiceId) await revertirPago(supabase, { stripe_payment_id: invoiceId });
    }

    if (event.type === "invoice.voided") {
      const invoice = event.data.object as Stripe.Invoice;
      await revertirPago(supabase, { stripe_payment_id: invoice.id });
    }
  } catch (err) {
    console.error("Error procesando webhook Stripe:", err);
    return res.status(500).json({ error: "Error interno" });
  }

  return res.status(200).json({ received: true });
}

async function resolveChargeId(invoice: Stripe.Invoice): Promise<string | null> {
  const inv = invoice as unknown as {
    id?: string;
    charge?: string | { id?: string };
    payment_intent?: string | { id?: string };
    payments?: { data?: Array<{ payment?: { payment_intent?: string | { id?: string }; charge?: string | { id?: string } } }> };
  };

  // 1) Legacy fields (pre-basil)
  if (inv.charge) return typeof inv.charge === "string" ? inv.charge : inv.charge.id ?? null;

  let piId: string | null = null;
  if (inv.payment_intent) {
    piId = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent.id ?? null;
  }

  // 2) New basil/dahlia: invoice.payments (may need expansion)
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
      console.error("invoice.payments expand failed:", e);
    }
  }

  if (!piId) return null;
  const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
  const lc = pi.latest_charge as Stripe.Charge | string | null;
  return (typeof lc === "string" ? lc : lc?.id) ?? null;
}

async function fetchStripeFees(invoice: Stripe.Invoice): Promise<{ fee: number; tax: number }> {
  try {
    const chargeId = await resolveChargeId(invoice);
    if (!chargeId) {
      console.warn("Stripe fee lookup: no charge id for invoice", invoice.id);
      return { fee: 0, tax: 0 };
    }

    const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    if (!bt) return { fee: 0, tax: 0 };
    const fee = (bt.fee ?? 0) / 100;
    const taxAmount = (bt.fee_details ?? [])
      .filter((f) => f.type === "tax")
      .reduce((s, f) => s + (f.amount ?? 0), 0);
    return { fee: fee - taxAmount / 100, tax: taxAmount / 100 };
  } catch (e) {
    console.error("Stripe fee lookup failed:", e);
    return { fee: 0, tax: 0 };
  }
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const monto = (invoice.amount_paid ?? 0) / 100;
  const { fee, tax } = await fetchStripeFees(invoice);

  const { data: corredor } = await supabase
    .from("corredores")
    .select("id")
    .eq("stripe_customer_id", invoice.customer as string)
    .single();

  if (corredor) {
    const lineDesc = invoice.lines?.data?.[0]?.description ?? null;
    const customerName = invoice.customer_name ?? invoice.customer_email ?? null;
    const descParts = [
      lineDesc ?? "Membresía Wave One",
      customerName,
      `factura ${invoice.id}`,
    ].filter(Boolean);
    const descripcion = descParts.join(" — ");

    const { data: txRow, error: upsertErr } = await supabase
      .from("transacciones")
      .upsert(
        {
          tipo: "ingreso",
          descripcion,
          monto,
          comision: fee,
          comision_impuesto: tax,
          fecha: new Date((invoice.created ?? Date.now() / 1000) * 1000).toISOString().split("T")[0],
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
        if (rpcErr) console.error("aplicar_pago Stripe error:", rpcErr.message);
      }
    }
  } else {
    const { error: insertErr } = await supabase.from("pagos_sin_asignar").insert({
      fuente: "stripe",
      payload: invoice as unknown as Record<string, unknown>,
      monto,
      fecha: new Date((invoice.created ?? Date.now() / 1000) * 1000).toISOString().split("T")[0],
    });
    if (insertErr) throw new Error(`DB error: ${insertErr.message}`);
  }
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const { data: corredor } = await supabase
    .from("corredores")
    .select("id")
    .eq("stripe_customer_id", invoice.customer as string)
    .single();

  if (corredor) {
    const { error: upsertErr } = await supabase.from("transacciones").upsert(
      {
        tipo: "ingreso",
        descripcion: `Pago fallido Stripe — factura ${invoice.id}`,
        monto: (invoice.amount_due ?? 0) / 100,
        fecha: new Date((invoice.created ?? Date.now() / 1000) * 1000).toISOString().split("T")[0],
        categoria: "membresia",
        metodo: "stripe",
        estado: "vencido",
        corredor_id: corredor.id,
        stripe_payment_id: invoice.id,
      },
      { onConflict: "stripe_payment_id" }
    );
    if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);
  }
}
