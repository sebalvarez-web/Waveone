import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";

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

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "STRIPE_WEBHOOK_SECRET no está configurado. Los webhooks no se pueden verificar."
    );
    return res.status(500).json({ error: "Webhook no configurado" });
  }

  const signature = req.headers["stripe-signature"] as string | undefined;
  if (!signature) {
    console.error("Webhook Stripe recibido sin header stripe-signature");
    return res.status(400).json({ error: "Firma faltante" });
  }

  const rawBody = await getRawBody(req);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error(
      "Verificación de firma Stripe falló:",
      err instanceof Error ? err.message : err
    );
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
      const paymentIntentId = charge.payment_intent as string | null;
      if (paymentIntentId) {
        await supabase
          .from("transacciones")
          .update({ estado: "reembolsado" })
          .eq("stripe_payment_id", paymentIntentId);
      }
    }
  } catch (err) {
    console.error(
      `Error procesando webhook Stripe ${event.type} (id=${event.id}):`,
      err instanceof Error ? err.message : err
    );
    return res.status(500).json({ error: "Error interno" });
  }

  return res.status(200).json({ received: true });
}

async function fetchStripeFees(invoice: Stripe.Invoice): Promise<{ fee: number; tax: number }> {
  const chargeId = (invoice as unknown as { charge?: string }).charge
    ?? (invoice as unknown as { latest_charge?: string }).latest_charge;
  if (!chargeId) return { fee: 0, tax: 0 };
  try {
    const charge = await stripe.charges.retrieve(chargeId as string, {
      expand: ["balance_transaction"],
    });
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    if (!bt) return { fee: 0, tax: 0 };
    const fee = (bt.fee ?? 0) / 100;
    const taxAmount = (bt.fee_details ?? [])
      .filter((f) => f.type === "tax")
      .reduce((s, f) => s + (f.amount ?? 0), 0);
    const feeWithoutTax = fee - taxAmount / 100;
    return { fee: feeWithoutTax, tax: taxAmount / 100 };
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
    const { data: txRow, error: upsertErr } = await supabase
      .from("transacciones")
      .upsert(
        {
          tipo: "ingreso",
          descripcion: `Pago Stripe — factura ${invoice.id}`,
          monto,
          comision: fee,
          comision_impuesto: tax,
          fecha: new Date().toISOString().split("T")[0],
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
      const { error: rpcErr } = await supabase.rpc("aplicar_pago", {
        p_transaccion_id: txRow.id,
        p_corredor_id: corredor.id,
        p_monto: monto,
        p_mes_override: null,
        p_anio_override: null,
      });
      if (rpcErr) console.error("aplicar_pago Stripe error:", rpcErr.message);
    }
  } else {
    const { error: insertErr } = await supabase.from("pagos_sin_asignar").insert({
      fuente: "stripe",
      payload: invoice as unknown as Record<string, unknown>,
      monto,
      fecha: new Date().toISOString().split("T")[0],
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
        fecha: new Date().toISOString().split("T")[0],
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
