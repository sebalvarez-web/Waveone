import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { createServerClient } from "@/lib/supabase-server";

/**
 * POST /api/admin/crear-coach
 * Body: { nombre: string, telefono?: string }
 *
 * Crea un coach independiente de auth.users. Solo admins.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { nombre, telefono } = req.body ?? {};
  if (typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({ error: "Nombre requerido" });
  }

  const userClient = createPagesServerClient({ req, res });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return res.status(401).json({ error: "No autenticado" });

  const admin = createServerClient();

  // Verificar admin (esquema nuevo y legado)
  let rol: string | null = null;
  const { data: byAuth } = await admin
    .from("users")
    .select("rol")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (byAuth) rol = byAuth.rol;
  if (!rol) {
    const { data: byId } = await admin
      .from("users")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();
    if (byId) rol = byId.rol;
  }
  if (rol !== "admin") return res.status(403).json({ error: "Solo admins" });

  const { data, error } = await admin
    .from("coaches")
    .insert({
      nombre: nombre.trim(),
      telefono: typeof telefono === "string" && telefono.trim() ? telefono.trim() : null,
    })
    .select("id, nombre, telefono")
    .single();

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes('relation "public.coaches"') || msg.includes("does not exist")) {
      return res.status(500).json({
        error: "Falta aplicar la migración 009_coaches_limpio.sql en Supabase.",
      });
    }
    return res.status(500).json({ error: msg });
  }
  return res.status(200).json({ coach: data });
}
