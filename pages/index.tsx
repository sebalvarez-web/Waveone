import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout/Layout";
import { TarjetaMetrica } from "@/components/finanzas/TarjetaMetrica";
import { useMetricasDashboard } from "@/hooks/useMetricasDashboard";
import { useTransacciones } from "@/hooks/useTransacciones";

function formatCurrency(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function pctChange(actual: number, anterior: number) {
  if (anterior === 0) return "+0%";
  const pct = ((actual - anterior) / anterior) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs mes anterior`;
}

export default function DashboardPage() {
  const { metricas, loading } = useMetricasDashboard();
  const { transacciones } = useTransacciones({ limit: 6 });

  return (
    <>
      <Head><title>Wave One — Panel</title></Head>
      <Layout>
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-label-caps text-on-surface-variant mb-2">DASHBOARD</p>
            <h2 className="text-headline-lg text-on-background font-headline">
              Resumen del panel
            </h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              Métricas de rendimiento y salud financiera en tiempo real.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3.5 py-2.5 bg-white border border-outline-variant rounded-lg text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">filter_alt</span>
              Filtros
            </button>
            <button className="px-3.5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-fixed transition-colors flex items-center gap-2 shadow-soft">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Exportar
            </button>
          </div>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-outline-variant/60 rounded-2xl p-5 h-44 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <TarjetaMetrica
              titulo="CORREDORES ACTIVOS"
              valor={String(metricas.totalCorredoresActivos)}
              tendencia="+12% mes anterior"
              icono="directions_run"
              colorIcono="text-accent"
            />
            <TarjetaMetrica
              titulo="INGRESOS DEL MES"
              valor={formatCurrency(metricas.ingresosMes)}
              tendencia={pctChange(metricas.ingresosMes, metricas.ingresosMesAnterior)}
              icono="account_balance_wallet"
              colorIcono="text-secondary"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <div className="px-3 py-2 rounded-lg bg-surface-container-low">
                  <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">STRIPE</p>
                  <p className="text-sm font-mono font-semibold text-on-surface mt-0.5 tabular-nums">
                    {formatCurrency(metricas.ingresosStripe)}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-surface-container-low">
                  <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">PAYPAL</p>
                  <p className="text-sm font-mono font-semibold text-on-surface mt-0.5 tabular-nums">
                    {formatCurrency(metricas.ingresosPaypal)}
                  </p>
                </div>
              </div>
            </TarjetaMetrica>
            <TarjetaMetrica
              titulo="GASTOS PENDIENTES"
              valor={formatCurrency(metricas.gastosPendientes)}
              tendencia={`${metricas.cantidadGastosPendientes} requieren aprobación`}
              tendenciaNegativa
              icono="receipt_long"
              colorIcono="text-tertiary"
            >
              <Link
                href="/gastos"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-sm font-semibold text-on-surface transition-colors"
              >
                Revisar todo
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </TarjetaMetrica>
          </div>
        )}

        {/* Transacciones recientes */}
        <div className="bg-white border border-outline-variant/60 rounded-2xl overflow-hidden shadow-soft">
          <div className="px-5 py-4 border-b border-outline-variant/40 flex justify-between items-center">
            <div>
              <h3 className="text-headline-sm font-headline text-on-surface">Transacciones recientes</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Últimos 6 movimientos registrados</p>
            </div>
            <Link
              href="/finanzas"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              Ver todas
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left tabular-nums">
              <thead>
                <tr className="bg-surface-container-low/60">
                  {["FECHA", "DESCRIPCIÓN", "CATEGORÍA", "MÉTODO", "MONTO", "ESTADO"].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {transacciones.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-on-surface-variant font-mono">
                      {new Date(t.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-on-surface">
                      {t.descripcion}
                      {t.corredor && (
                        <span className="text-on-surface-variant ml-1.5">· {t.corredor.nombre}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-on-surface-variant capitalize">{t.categoria}</td>
                    <td className="px-5 py-3.5 text-sm text-on-surface-variant capitalize">{t.metodo}</td>
                    <td className={`px-5 py-3.5 text-right font-mono text-sm font-semibold ${
                      t.tipo === "ingreso" ? "text-secondary" : "text-error"
                    }`}>
                      {t.tipo === "ingreso" ? "+" : "−"}{formatCurrency(t.monto)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Estado estado={t.estado} />
                    </td>
                  </tr>
                ))}
                {transacciones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl text-outline">inbox</span>
                        <p className="text-sm">Aún no hay transacciones registradas.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Layout>
    </>
  );
}

function Estado({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    pagado:        { bg: "bg-secondary-container", text: "text-on-secondary-container", dot: "bg-secondary", label: "Pagado" },
    pendiente:     { bg: "bg-surface-container",   text: "text-on-surface-variant",     dot: "bg-outline",   label: "Pendiente" },
    vencido:       { bg: "bg-error-container",     text: "text-on-error-container",     dot: "bg-error",     label: "Vencido" },
    reembolsado:   { bg: "bg-tertiary-container",  text: "text-on-tertiary-container",  dot: "bg-tertiary",  label: "Reembolsado" },
  };
  const cfg = map[estado] ?? map.pendiente;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
