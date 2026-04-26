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
      const paymentIntentId = charge.payment_intent as string | null;
      if (paymentIntentId) {
        await supabase
          .from("transacciones")
          .update({ estado: "reembolsado" })
          .eq("stripe_payment_id", paymentIntentId);
      }
    }
  } catch (err) {
    console.error("Error procesando webhook Stripe:", err);
    return res.status(500).json({ error: "Error interno" });
  }

  return res.status(200).json({ received: true });
}

async function handlePaymentSucceeded(
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
        descripcion: `Pago Stripe — factura ${invoice.id}`,
        monto: (invoice.amount_paid ?? 0) / 100,
        fecha: new Date().toISOString().split("T")[0],
        categoria: "membresia",
        metodo: "stripe",
        estado: "pagado",
        corredor_id: corredor.id,
        stripe_payment_id: invoice.id,
      },
      { onConflict: "stripe_payment_id" }
    );
    if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`);
  } else {
    const { error: insertErr } = await supabase.from("pagos_sin_asignar").insert({
      fuente: "stripe",
      payload: invoice as unknown as Record<string, unknown>,
      monto: (invoice.amount_paid ?? 0) / 100,
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
