import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { corredor_id, stripe_price_id } = req.body as {
    corredor_id: string;
    stripe_price_id: string;
  };

  if (!corredor_id || !stripe_price_id) {
    return res.status(400).json({ error: "corredor_id y stripe_price_id son requeridos" });
  }

  const supabase = createServerClient();

  const { data: corredor, error: corrErr } = await supabase
    .from("corredores")
    .select("id, email, nombre, stripe_customer_id")
    .eq("id", corredor_id)
    .single();

  if (corrErr || !corredor) {
    return res.status(404).json({ error: "Corredor no encontrado" });
  }

  try {
    let stripeCustomerId = corredor.stripe_customer_id;

    if (!stripeCustomerId) {
      const existing = await stripe.customers.list({ email: corredor.email, limit: 1 });

      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email: corredor.email,
          name: corredor.nombre,
          metadata: { corredor_id },
        });
        stripeCustomerId = newCustomer.id;
      }

      const { error: updateCustErr } = await supabase
        .from("corredores")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", corredor_id);
      if (updateCustErr) {
        console.error("No se pudo persistir stripe_customer_id:", updateCustErr);
      }
    }

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: stripe_price_id }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    const { error: updateSubErr } = await supabase
      .from("corredores")
      .update({ stripe_subscription_id: subscription.id })
      .eq("id", corredor_id);
    if (updateSubErr) {
      console.error("No se pudo persistir stripe_subscription_id:", updateSubErr);
    }

    const invoice = subscription.latest_invoice as
      | { payment_intent?: { client_secret?: string | null } | string | null }
      | string
      | null;
    const clientSecret =
      invoice && typeof invoice !== "string" && invoice.payment_intent
        ? typeof invoice.payment_intent !== "string"
          ? invoice.payment_intent.client_secret ?? null
          : null
        : null;

    return res.status(200).json({
      subscription_id: subscription.id,
      client_secret: clientSecret,
    });
  } catch (err) {
    console.error("Error al crear suscripción Stripe:", err);
    return res.status(500).json({ error: "Error al crear suscripción" });
  }
}
