import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useCoach } from "@/hooks/useCoach";
import { useTransacciones } from "@/hooks/useTransacciones";
import { usePagosAplicados } from "@/hooks/usePagosAplicados";
import { usePausasAll } from "@/hooks/usePausasAll";
import { TablaCorredores, type Balance } from "@/components/corredores/TablaCorredores";
import { calcularDeudas, MESES_ES } from "@/lib/deudas";

export default function CoachDetailPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { stats, loading } = useCoach(id);
  const { transacciones } = useTransacciones({ soloIngresoPagado: true });
  const { pagosAplicados } = usePagosAplicados();
  const { pausas } = usePausasAll();

  const balances: Record<string, Balance> = useMemo(() => {
    if (!stats) return {};
    const result: Record<string, Balance> = {};
    const deudas = calcularDeudas(stats.corredores, transacciones, pausas, pagosAplicados);
    const totalPagadoPorCorredor: Record<string, number> = {};
    for (const t of transacciones) {
      if (t.tipo !== "ingreso" || t.estado !== "pagado" || !t.corredor_id) continue;
      totalPagadoPorCorredor[t.corredor_id] = (totalPagadoPorCorredor[t.corredor_id] ?? 0) + Number(t.monto);
    }
    for (const d of deudas) {
      const precio = d.corredor.plan?.precio_mensual ?? 0;
      const mesesActivos = d.meses.filter(m => m.estado === "pagado" || m.estado === "deuda").length;
      const totalDevengado = mesesActivos * precio;
      const totalPagado = totalPagadoPorCorredor[d.corredor.id] ?? 0;
      const mesesPagados = precio > 0 ? totalPagado / precio : 0;
      result[d.corredor.id] = {
        devengados: mesesActivos,
        pagados: Math.round(mesesPagados * 10) / 10,
        saldo: totalPagado - totalDevengado,
      };
    }
    return result;
  }, [stats, transacciones, pausas, pagosAplicados]);

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
              {stats.coach.telefono && <p className="text-body-md text-outline">{stats.coach.telefono}</p>}
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
            <TablaCorredores
              corredores={stats.corredores}
              balances={balances}
              loading={false}
              hideEntrenador
            />
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
