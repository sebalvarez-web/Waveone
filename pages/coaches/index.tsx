import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout/Layout";
import type { User } from "@/types/database";

interface CoachRow extends User {
  totalCorredores: number;
  corredoresActivos: number;
}

export default function CoachesPage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRol, setUserRol] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("rol")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const rol = data?.rol ?? "";
        setUserRol(rol);
        if (rol === "entrenador") {
          router.replace(`/coaches/${user.id}`);
        }
      });
  }, [user, supabase, router]);

  useEffect(() => {
    if (userRol !== "admin") return;
    supabase
      .from("users")
      .select("*")
      .eq("rol", "entrenador")
      .then(async ({ data: entrenadores }) => {
        if (!entrenadores) { setLoading(false); return; }
        const rows = await Promise.all(
          entrenadores.map(async (e) => {
            const { data: corredores } = await supabase
              .from("corredores")
              .select("id, estado")
              .eq("entrenador_id", e.id);
            return {
              ...e,
              totalCorredores: corredores?.length ?? 0,
              corredoresActivos: corredores?.filter((c) => c.estado === "activo").length ?? 0,
            } as CoachRow;
          })
        );
        setCoaches(rows);
        setLoading(false);
      });
  }, [userRol, supabase]);

  if (userRol === "entrenador") return null;

  return (
    <>
      <Head><title>Wave One — Coaches</title></Head>
      <Layout>
        <div className="space-y-8">
          <h2 className="text-headline-lg text-on-surface font-headline">Coaches</h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-lowest border-b border-slate-100">
                    {["NOMBRE", "EMAIL", "CORREDORES", "ACTIVOS", ""].map((h) => (
                      <th key={h} className="px-6 py-4 font-label-caps text-on-surface-variant text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coaches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-outline text-sm">
                        No hay coaches registrados.
                      </td>
                    </tr>
                  )}
                  {coaches.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-on-surface text-sm">{c.nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{c.email}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{c.totalCorredores}</td>
                      <td className="px-6 py-4 text-sm text-secondary font-semibold">{c.corredoresActivos}</td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/coaches/${c.id}`}
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          Ver detalle
                          <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
