import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { Layout } from "@/components/layout/Layout";
import { useCoach } from "@/hooks/useCoach";
import { MESES_ES } from "@/lib/deudas";

export default function CoachDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { stats, loading } = useCoach(id);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <p className="text-outline">Coach no encontrado.</p>
      </Layout>
    );
  }

  return (
    <>
      <Head><title>Wave One — {stats.coach.nombre}</title></Head>
      <Layout>
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/coaches" className="text-outline hover:text-on-surface">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div>
              <h2 className="text-headline-lg text-on-surface font-headline">{stats.coach.nombre}</h2>
              <p className="text-body-md text-outline">{stats.coach.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Total Corredores", value: stats.corredores.length },
              { label: "Activos", value: stats.totalActivos },
              { label: "Ingresos del Mes", value: `$${stats.ingresosMes.toFixed(2)}` },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-6">
                <p className="text-label-caps text-slate-400 uppercase mb-2 text-xs">{m.label}</p>
                <span className="text-headline-md font-headline text-on-surface">{m.value}</span>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-headline-sm font-headline text-on-surface mb-4">Corredores asignados</h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-lowest border-b border-slate-100">
                    {["NOMBRE", "PLAN", "ESTADO"].map((h) => (
                      <th key={h} className="px-6 py-4 font-label-caps text-on-surface-variant text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.corredores.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-outline text-sm">
                        Sin corredores asignados.
                      </td>
                    </tr>
                  )}
                  {stats.corredores.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-semibold text-sm">
                        <Link href={`/corredores/${c.id}`} className="text-primary hover:underline">{c.nombre}</Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{c.plan?.nombre ?? "Sin plan"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          c.estado === "activo" ? "bg-secondary/10 text-secondary" :
                          c.estado === "pausado" ? "bg-primary/10 text-primary" :
                          "bg-slate-100 text-slate-500"
                        }`}>{c.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {stats.historial.length > 0 && (
            <div>
              <h3 className="text-headline-sm font-headline text-on-surface mb-4">Historial reciente</h3>
              <div className="space-y-2">
                {stats.historial.map((h) => (
                  <div key={h.id} className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-start gap-4">
                    <span className="material-symbols-outlined text-outline text-sm mt-0.5">history</span>
                    <div>
                      <p className="text-sm text-on-surface">
                        {h.tipo === "cambio_estado" && `Estado: ${h.estado_anterior} → ${h.estado_nuevo}`}
                        {h.tipo === "cambio_plan" && `Plan: ${h.plan_anterior?.nombre ?? "-"} → ${h.plan_nuevo?.nombre ?? "-"}`}
                        {h.tipo === "pausa" && `Pausa: ${MESES_ES[(h.mes ?? 1) - 1]} ${h.año}`}
                        {h.tipo === "nota" && h.nota}
                      </p>
                      <p className="text-xs text-outline mt-0.5">
                        {new Date(h.fecha).toLocaleDateString("es-MX")}
                        {h.creado_por_user && ` · ${h.creado_por_user.nombre}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
