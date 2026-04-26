import Head from "next/head";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { FormGasto } from "@/components/finanzas/FormGasto";
import { useTransacciones } from "@/hooks/useTransacciones";
import type { Transaccion, TransaccionEstado } from "@/types/database";

type FiltroEstado = "todos" | TransaccionEstado;
type FiltroCategoria = "todos" | string;

const CATEGORIAS = ["instalaciones", "equipamiento", "viaje", "marketing", "otro"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    pagado:    { bg: "bg-secondary-container", text: "text-on-secondary-container", dot: "bg-secondary", label: "Pagado" },
    pendiente: { bg: "bg-tertiary-container",  text: "text-on-tertiary-container",  dot: "bg-tertiary",  label: "Pendiente" },
    vencido:   { bg: "bg-error-container",     text: "text-on-error-container",     dot: "bg-error",     label: "Vencido" },
  };
  const cfg = map[estado] ?? { bg: "bg-surface-container", text: "text-on-surface-variant", dot: "bg-outline", label: estado };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TablaGastos({ rows, loading }: { rows: Transaccion[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="h-12 bg-surface-container-low rounded-lg animate-pulse" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="flex flex-col items-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl text-outline">receipt_long</span>
          <p className="text-sm">Sin gastos para este filtro.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-outline-variant/40 text-left bg-surface-container-low/40">
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">FECHA</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">DESCRIPCIÓN</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">CATEGORÍA</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">ESTADO</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant text-right">MONTO</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30">
          {rows.map(t => (
            <tr key={t.id} className="hover:bg-surface-container-low/40 transition-colors">
              <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap font-mono text-xs">
                {new Date(t.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </td>
              <td className="px-5 py-3.5 text-on-surface font-semibold max-w-xs truncate">{t.descripcion}</td>
              <td className="px-5 py-3.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container-low text-on-surface-variant capitalize">
                  {t.categoria}
                </span>
              </td>
              <td className="px-5 py-3.5"><BadgeEstado estado={t.estado} /></td>
              <td className="px-5 py-3.5 text-right font-mono text-error font-semibold">
                −${fmt(Number(t.monto))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GastosPage() {
  const { transacciones, loading, refetch } = useTransacciones({ limit: 500 });
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>("todos");
  const [mostrarForm, setMostrarForm] = useState(false);

  const gastos = transacciones.filter(t => t.tipo === "gasto");

  const totalGastos     = gastos.reduce((s,t) => s + Number(t.monto), 0);
  const totalPagados    = gastos.filter(t => t.estado === "pagado").reduce((s,t) => s + Number(t.monto), 0);
  const totalPendientes = gastos.filter(t => t.estado === "pendiente").reduce((s,t) => s + Number(t.monto), 0);
  const totalVencidos   = gastos.filter(t => t.estado === "vencido").reduce((s,t) => s + Number(t.monto), 0);

  const filtered = gastos.filter(t => {
    const okEstado = filtroEstado === "todos" || t.estado === filtroEstado;
    const okCategoria = filtroCategoria === "todos" || t.categoria === filtroCategoria;
    return okEstado && okCategoria;
  });

  return (
    <>
      <Head><title>Wave One — Gastos</title></Head>
      <Layout>
        <div className="flex justify-between items-end mb-6 flex-wrap gap-4">
          <div>
            <p className="text-label-caps text-on-surface-variant mb-2">FINANZAS</p>
            <h2 className="text-headline-lg text-on-background font-headline">Gastos</h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              Registro y seguimiento de todos los egresos operativos.
            </p>
          </div>
          <button
            onClick={() => setMostrarForm(v => !v)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-soft ${
              mostrarForm
                ? "bg-white border border-outline-variant text-on-surface hover:bg-surface-container-low"
                : "bg-primary text-white hover:bg-primary-fixed"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{mostrarForm ? "close" : "add"}</span>
            {mostrarForm ? "Cancelar" : "Nuevo gasto"}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-primary text-white rounded-xl p-4 shadow-soft relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-accent/20 blur-2xl" />
            <p className="text-[10px] font-bold tracking-wider text-white/70 relative">TOTAL GASTOS</p>
            <p className="text-3xl font-headline font-bold mt-2 tabular-nums tracking-tight relative">
              ${fmt(totalGastos)}
            </p>
            <p className="text-[11px] text-white/60 mt-1 relative">{gastos.length} registros</p>
          </div>
          <KpiGasto label="PAGADOS" total={totalPagados} count={gastos.filter(t=>t.estado==="pagado").length} tone="success" />
          <KpiGasto label="PENDIENTES" total={totalPendientes} count={gastos.filter(t=>t.estado==="pendiente").length} tone="warning" />
          <KpiGasto label="VENCIDOS" total={totalVencidos} count={gastos.filter(t=>t.estado==="vencido").length} tone="danger" />
        </div>

        {/* Form colapsable */}
        {mostrarForm && (
          <div className="bg-white border border-outline-variant/60 rounded-xl p-5 mb-6 shadow-soft">
            <h3 className="text-headline-sm font-headline flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-tertiary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary text-[18px]">receipt_long</span>
              </span>
              Registrar gasto
            </h3>
            <FormGasto onSuccess={() => { refetch(); setMostrarForm(false); }} />
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white border border-outline-variant/60 rounded-xl overflow-hidden shadow-soft">
          <div className="px-5 py-3 border-b border-outline-variant/40 flex flex-wrap gap-2 items-center bg-surface-container-low/40">
            <h3 className="text-headline-sm font-headline text-on-surface mr-auto">Historial</h3>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">filter_alt</span>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="border border-outline-variant bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all cursor-pointer"
            >
              <option value="todos">Todas las categorías</option>
              {CATEGORIAS.map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}
              className="border border-outline-variant bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all cursor-pointer"
            >
              <option value="todos">Todos los estados</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
          <TablaGastos rows={filtered} loading={loading} />
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 bg-surface-container-low/40 border-t border-outline-variant/40 flex justify-between text-xs text-on-surface-variant">
              <span>
                Mostrando <span className="font-semibold text-on-surface">{filtered.length}</span> de{" "}
                <span className="font-semibold text-on-surface">{gastos.length}</span> gastos
              </span>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}

function KpiGasto({ label, total, count, tone }: { label: string; total: number; count: number; tone: "success" | "warning" | "danger" }) {
  const colors = {
    success: "text-secondary",
    warning: "text-tertiary",
    danger:  "text-error",
  };
  return (
    <div className="bg-white border border-outline-variant/60 rounded-xl p-4 shadow-soft">
      <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">{label}</p>
      <p className={`text-2xl font-headline font-bold mt-2 tabular-nums tracking-tight ${colors[tone]}`}>
        ${fmt(total)}
      </p>
      <p className="text-[11px] text-on-surface-variant mt-1">{count} registros</p>
    </div>
  );
}
