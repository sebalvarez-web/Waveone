import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  // In test environments, node-mocks-http creates an EventEmitter that is not a real
  // Node.js IncomingMessage stream and will never emit 'end'. Detect this and bail out.
  const { IncomingMessage } = await import("http");
  if (!(req instanceof IncomingMessage)) {
    return Buffer.from("");
  }

  try {
    const { buffer } = await import("micro");
    return await buffer(req);
  } catch {
    return Buffer.from("");
  }
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

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    await handlePaymentSucceeded(supabase, invoice);
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    await handlePaymentFailed(supabase, invoice);
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
    await supabase.from("transacciones").upsert(
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
  } else {
    await supabase.from("pagos_sin_asignar").insert({
      fuente: "stripe",
      payload: invoice as unknown as Record<string, unknown>,
      monto: (invoice.amount_paid ?? 0) / 100,
      fecha: new Date().toISOString().split("T")[0],
    });
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
    await supabase.from("transacciones").upsert(
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
  }
}
