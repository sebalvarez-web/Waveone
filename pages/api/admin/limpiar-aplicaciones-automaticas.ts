import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { createServerClient } from "@/lib/supabase-server";

/**
 * POST /api/admin/limpiar-aplicaciones-automaticas
 * Body: { desde?: ISO string, dry?: boolean }
 *
 * Borra filas de `pagos_aplicados` con `aplicado_automatico = true`
 * creadas a partir de `desde` (default: 24h atrás). No toca las
 * aplicadas manualmente (aplicado_automatico = false).
 *
 * Úsalo para deshacer una corrida masiva accidental de aplicar_pago
 * que reasignó meses-adeuda a transacciones históricas.
 *
 * Pasa { dry: true } para ver qué se borraría sin ejecutar.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const userClient = createPagesServerClient({ req, res });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: "No autenticado" });

  const { data: caller } = await userClient
    .from("users")
    .select("rol")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (caller?.rol !== "admin") return res.status(403).json({ error: "Solo admins" });

  const { desde, dry } = req.body ?? {};
  const cutoff = typeof desde === "string"
    ? new Date(desde)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (Number.isNaN(cutoff.getTime())) {
    return res.status(400).json({ error: "Fecha 'desde' inválida" });
  }

  const admin = createServerClient();

  const { data: rowsRaw, error: selErr } = await admin
    .from("pagos_aplicados")
    .select("*")
    .eq("aplicado_automatico", true)
    .gte("created_at", cutoff.toISOString());
  const rows = rowsRaw as { id: string; transaccion_id: string; corredor_id: string; mes: number; monto: number; created_at: string }[] | null;

  if (selErr) return res.status(500).json({ error: selErr.message });

  if (dry) {
    return res.status(200).json({
      dry: true,
      cutoff: cutoff.toISOString(),
      total: rows?.length ?? 0,
      rows: rows ?? [],
    });
  }

  if (!rows || rows.length === 0) {
    return res.status(200).json({ borradas: 0, cutoff: cutoff.toISOString() });
  }

  const { error: delErr } = await admin
    .from("pagos_aplicados")
    .delete()
    .in("id", rows.map(r => r.id));

  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.status(200).json({ borradas: rows.length, cutoff: cutoff.toISOString() });
}
