import type { NextApiRequest, NextApiResponse } from "next";
import { getPayPalAccessToken, PAYPAL_BASE_URL } from "@/lib/paypal";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const checks: Record<string, string> = {
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID ? "configurado" : "FALTA",
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET ? "configurado" : "FALTA",
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID ? "configurado" : "no configurado (opcional)",
    base_url: PAYPAL_BASE_URL,
  };

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return res.status(200).json({ ok: false, checks, error: "Variables de entorno faltantes" });
  }

  try {
    const token = await getPayPalAccessToken();
    checks.auth = token ? "OK — token obtenido" : "FALLO — token vacío";
    return res.status(200).json({ ok: true, checks });
  } catch (err) {
    return res.status(200).json({ ok: false, checks, error: String(err) });
  }
}
