import type { NextApiRequest, NextApiResponse } from "next";
import { paypalFetch } from "@/lib/paypal";
import { createServerClient } from "@/lib/supabase-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { corredor_id, paypal_plan_id } = req.body as {
    corredor_id: string;
    paypal_plan_id: string;
  };

  if (!corredor_id || !paypal_plan_id) {
    return res.status(400).json({ error: "corredor_id y paypal_plan_id son requeridos" });
  }

  const supabase = createServerClient();

  const { data: corredor, error: corrErr } = await supabase
    .from("corredores")
    .select("id, email, nombre, paypal_payer_id, paypal_subscription_id")
    .eq("id", corredor_id)
    .single();

  if (corrErr || !corredor) {
    return res.status(404).json({ error: "Corredor no encontrado" });
  }

  try {
    const response = await paypalFetch("/v1/billing/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: paypal_plan_id,
        subscriber: {
          email_address: corredor.email,
          name: {
            given_name: corredor.nombre.split(" ")[0],
            surname: corredor.nombre.split(" ").slice(1).join(" ") || corredor.nombre,
          },
        },
        application_context: {
          brand_name: "Wave One",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/corredores/${corredor_id}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/corredores/${corredor_id}`,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("PayPal subscription error:", err);
      return res.status(500).json({ error: "Error al crear suscripción en PayPal" });
    }

    const subscription = await response.json();

    const { error: updateErr } = await supabase
      .from("corredores")
      .update({ paypal_subscription_id: subscription.id })
      .eq("id", corredor_id);

    if (updateErr) {
      console.error("No se pudo persistir paypal_subscription_id:", updateErr);
      return res.status(500).json({ error: "Suscripción creada en PayPal pero no persistida" });
    }

    const approvalLink = subscription.links?.find(
      (l: { rel: string; href: string }) => l.rel === "approve"
    )?.href;

    return res.status(200).json({
      subscription_id: subscription.id,
      approval_url: approvalLink,
    });
  } catch (err) {
    console.error("Error al crear suscripción PayPal:", err);
    return res.status(500).json({ error: "Error interno" });
  }
}
