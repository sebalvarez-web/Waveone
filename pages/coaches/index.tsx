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
        <div className="space-y-6">
          <div>
            <p className="text-label-caps text-on-surface-variant mb-2">EQUIPO</p>
            <h2 className="text-headline-lg text-on-background font-headline">Coaches</h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              Entrenadores activos y sus equipos asignados.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-white border border-outline-variant/60 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : coaches.length === 0 ? (
            <div className="bg-white border border-outline-variant/60 rounded-xl p-12 text-center shadow-soft">
              <span className="material-symbols-outlined text-4xl text-outline">sports</span>
              <p className="text-sm text-on-surface-variant mt-2">No hay coaches registrados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coaches.map((c) => {
                const initials = c.nombre.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <Link
                    key={c.id}
                    href={`/coaches/${c.id}`}
                    className="group bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft hover:shadow-elev hover:border-outline transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-fixed text-white flex items-center justify-center font-bold flex-shrink-0">
                        {initials || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-headline-sm font-headline text-on-surface truncate">{c.nombre}</h3>
                        <p className="text-xs text-on-surface-variant truncate">{c.email}</p>
                      </div>
                      <span className="material-symbols-outlined text-outline group-hover:text-accent group-hover:translate-x-0.5 transition-all">
                        arrow_forward
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-4 border-t border-outline-variant/40">
                      <div>
                        <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">CORREDORES</p>
                        <p className="text-2xl font-headline font-bold text-on-surface tabular-nums">{c.totalCorredores}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">ACTIVOS</p>
                        <p className="text-2xl font-headline font-bold text-secondary tabular-nums">{c.corredoresActivos}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
