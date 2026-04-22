import Head from "next/head";
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
  const { transacciones } = useTransacciones({ limit: 5 });

  return (
    <>
      <Head><title>RunTeam Pro — Panel</title></Head>
      <Layout>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-headline-lg text-primary font-headline">
              Resumen del Panel
            </h2>
            <p className="text-body-lg text-outline">
              Métricas de rendimiento y salud financiera en tiempo real.
            </p>
          </div>
          <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90">
            <span className="material-symbols-outlined text-lg">download</span>
            Exportar PDF
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-gutter mb-gutter">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-md h-40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-gutter mb-gutter">
            <div className="col-span-12 md:col-span-4">
              <TarjetaMetrica
                titulo="TOTAL CORREDORES ACTIVOS"
                valor={String(metricas.totalCorredoresActivos)}
                tendencia={`+12% desde el mes pasado`}
                icono="directions_run"
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <TarjetaMetrica
                titulo="INGRESOS ESTE MES"
                valor={formatCurrency(metricas.ingresosMes)}
                tendencia={pctChange(metricas.ingresosMes, metricas.ingresosMesAnterior)}
                icono="account_balance_wallet"
                colorIcono="text-secondary"
              >
                <div className="flex gap-4">
                  <div className="flex-1 bg-secondary-container/20 p-2 rounded-lg border border-secondary/10">
                    <p className="font-label-caps text-[10px] text-on-secondary-container">STRIPE</p>
                    <p className="font-data-mono text-on-secondary-container">
                      {formatCurrency(metricas.ingresosStripe)}
                    </p>
                  </div>
                  <div className="flex-1 bg-blue-50 p-2 rounded-lg border border-blue-100">
                    <p className="font-label-caps text-[10px] text-blue-600">PAYPAL</p>
                    <p className="font-data-mono text-blue-600">
                      {formatCurrency(metricas.ingresosPaypal)}
                    </p>
                  </div>
                </div>
              </TarjetaMetrica>
            </div>
            <div className="col-span-12 md:col-span-4">
              <TarjetaMetrica
                titulo="GASTOS PENDIENTES"
                valor={formatCurrency(metricas.gastosPendientes)}
                tendencia={`${metricas.cantidadGastosPendientes} comprobantes requieren aprobación`}
                tendenciaNegativa
                icono="receipt_long"
                colorIcono="text-tertiary"
              >
                <button className="w-full py-2 bg-tertiary-container/10 text-tertiary text-sm rounded-lg hover:bg-tertiary-container/20 transition-all">
                  Revisar Todo
                </button>
              </TarjetaMetrica>
            </div>
          </div>
        )}

        {/* Tabla de transacciones recientes */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-gutter">
          <div className="px-md py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-headline-md text-on-surface font-headline">
              Registros Financieros Recientes
            </h3>
            <a href="/finanzas" className="text-primary text-sm font-semibold hover:underline">
              Ver Todos los Registros
            </a>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                {["FECHA", "DESCRIPCIÓN", "CATEGORÍA", "MÉTODO", "CANTIDAD", "ESTADO"].map((h) => (
                  <th key={h} className="px-md py-3 font-label-caps text-outline text-[11px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transacciones.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-md py-4 font-data-mono text-sm">
                    {new Date(t.fecha).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-md py-4 text-sm font-medium text-on-surface">
                    {t.descripcion}
                    {t.corredor && (
                      <span className="text-outline ml-1">({t.corredor.nombre})</span>
                    )}
                  </td>
                  <td className="px-md py-4 text-sm capitalize">{t.categoria}</td>
                  <td className="px-md py-4 text-sm capitalize">{t.metodo}</td>
                  <td className={`px-md py-4 text-right font-data-mono ${
                    t.tipo === "ingreso" ? "text-secondary" : "text-tertiary"
                  }`}>
                    {t.tipo === "ingreso" ? "+" : "-"}{formatCurrency(t.monto)}
                  </td>
                  <td className="px-md py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      t.estado === "pagado"
                        ? "bg-secondary/10 text-secondary"
                        : t.estado === "vencido"
                        ? "bg-tertiary/10 text-tertiary"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {t.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {transacciones.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-md py-8 text-center text-outline text-sm">
                    No hay transacciones registradas aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Layout>
    </>
  );
}
