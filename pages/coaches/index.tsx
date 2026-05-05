import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout/Layout";
import type { Coach } from "@/types/database";

interface CoachRow extends Coach {
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
  const [showForm, setShowForm] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/crear-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre, telefono: nuevoTelefono }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al crear coach");
      setNuevoNombre("");
      setNuevoTelefono("");
      setShowForm(false);
      setReloadKey(k => k + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1) ¿Es admin?
      const { data: adminRow } = await supabase
        .from("users")
        .select("rol")
        .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
        .eq("rol", "admin")
        .maybeSingle();
      if (adminRow) { setUserRol("admin"); return; }

      // 2) ¿Es coach? → redirigir a su detalle
      const { data: coachRow } = await supabase
        .from("coaches")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (coachRow?.id) {
        setUserRol("entrenador");
        router.replace(`/coaches/${coachRow.id}`);
        return;
      }
      setUserRol("none");
    })();
  }, [user, supabase, router]);

  useEffect(() => {
    if (userRol === "") return; // still resolving role
    if (userRol !== "admin") { setLoading(false); return; }
    setLoading(true);
    supabase
      .from("coaches")
      .select("*")
      .order("nombre", { ascending: true })
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
  }, [userRol, supabase, reloadKey]);

  if (userRol === "entrenador") return null;

  return (
    <>
      <Head><title>Wave One — Coaches</title></Head>
      <Layout>
        <div className="space-y-6">
          <div className="flex justify-between items-end gap-4 flex-wrap">
            <div>
              <p className="text-label-caps text-on-surface-variant mb-2">EQUIPO</p>
              <h2 className="text-headline-lg text-on-background font-headline">Coaches</h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Entrenadores activos y sus equipos asignados.
              </p>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-soft ${
                showForm
                  ? "bg-white border border-outline-variant text-on-surface hover:bg-surface-container-low"
                  : "bg-primary text-white hover:bg-primary-fixed"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{showForm ? "close" : "add"}</span>
              {showForm ? "Cancelar" : "Añadir coach"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleCrear}
              className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
            >
              <div>
                <label className="text-[10px] font-bold tracking-wider text-on-surface-variant block mb-1">NOMBRE</label>
                <input
                  required
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-wider text-on-surface-variant block mb-1">TELÉFONO (OPCIONAL)</label>
                <input
                  value={nuevoTelefono}
                  onChange={e => setNuevoTelefono(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-3.5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-fixed transition-colors disabled:opacity-60"
                >
                  {creating ? "Creando…" : "Crear coach"}
                </button>
                {formError && <p className="text-[11px] text-error">{formError}</p>}
                <p className="text-[10px] text-on-surface-variant">Coach independiente, sin acceso a la plataforma.</p>
              </div>
            </form>
          )}

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
                        {c.telefono && <p className="text-xs text-on-surface-variant truncate">{c.telefono}</p>}
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
