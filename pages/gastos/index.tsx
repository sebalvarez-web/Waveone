import Head from "next/head";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { FormGasto } from "@/components/finanzas/FormGasto";
import { useTransacciones } from "@/hooks/useTransacciones";
import type { Transaccion, TransaccionEstado } from "@/types/database";

type FiltroEstado = "todos" | TransaccionEstado;
type FiltroCategoria = "todos" | string;

const CATEGORIAS = ["instalaciones", "equipamiento", "viaje", "marketing", "otro"];

const ESTADO_BADGE: Record<string, string> = {
  pagado:   "bg-secondary/10 text-secondary",
  pendiente:"bg-yellow-100 text-yellow-700",
  vencido:  "bg-red-100 text-red-600",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TablaGastos({ rows, loading }: { rows: Transaccion[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="p-10 text-center text-outline text-sm">Sin gastos para este filtro.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left">
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Fecha</th>
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Descripción</th>
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Categoría</th>
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Estado</th>
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-outline whitespace-nowrap">
                {new Date(t.fecha).toLocaleDateString("es-MX")}
              </td>
              <td className="px-4 py-3 text-on-surface font-medium max-w-xs truncate">{t.descripcion}</td>
              <td className="px-4 py-3 text-on-surface-variant capitalize">{t.categoria}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${ESTADO_BADGE[t.estado] ?? "bg-slate-100 text-slate-600"}`}>
                  {t.estado}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-data-mono text-tertiary font-semibold">
                -${fmt(Number(t.monto))}
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

  const totalGastos    = gastos.reduce((s,t) => s + Number(t.monto), 0);
  const totalPagados   = gastos.filter(t => t.estado === "pagado").reduce((s,t) => s + Number(t.monto), 0);
  const totalPendientes= gastos.filter(t => t.estado === "pendiente").reduce((s,t) => s + Number(t.monto), 0);
  const totalVencidos  = gastos.filter(t => t.estado === "vencido").reduce((s,t) => s + Number(t.monto), 0);

  const filtered = gastos.filter(t => {
    const okEstado = filtroEstado === "todos" || t.estado === filtroEstado;
    const okCategoria = filtroCategoria === "todos" || t.categoria === filtroCategoria;
    return okEstado && okCategoria;
  });

  return (
    <>
      <Head><title>RunTeam Pro — Gastos</title></Head>
      <Layout>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-headline-lg text-on-background font-headline">Gastos</h2>
            <p className="text-body-lg text-on-surface-variant">
              Registro y seguimiento de todos los egresos operativos.
            </p>
          </div>
          <button
            onClick={() => setMostrarForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-tertiary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-sm">{mostrarForm ? "close" : "add"}</span>
            {mostrarForm ? "Cancelar" : "Nuevo Gasto"}
          </button>
        </div>

        {/* Tarjetas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter mb-8">
          <div className="bg-tertiary text-white rounded-xl p-md">
            <p className="text-label-caps text-white/70 mb-1">TOTAL GASTOS</p>
            <span className="text-headline-sm font-headline">${fmt(totalGastos)}</span>
            <p className="text-[11px] text-white/60 mt-1">{gastos.length} registros</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">PAGADOS</p>
            <span className="text-headline-sm font-headline text-secondary">${fmt(totalPagados)}</span>
            <p className="text-[11px] text-outline mt-1">{gastos.filter(t=>t.estado==="pagado").length} registros</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">PENDIENTES</p>
            <span className="text-headline-sm font-headline text-yellow-600">${fmt(totalPendientes)}</span>
            <p className="text-[11px] text-outline mt-1">{gastos.filter(t=>t.estado==="pendiente").length} registros</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">VENCIDOS</p>
            <span className="text-headline-sm font-headline text-red-600">${fmt(totalVencidos)}</span>
            <p className="text-[11px] text-outline mt-1">{gastos.filter(t=>t.estado==="vencido").length} registros</p>
          </div>
        </div>

        {/* Form colapsable */}
        {mostrarForm && (
          <div className="bg-white border border-slate-200 rounded-xl p-md mb-8">
            <h3 className="font-headline-sm flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-tertiary">receipt_long</span>
              Registrar Gasto
            </h3>
            <FormGasto onSuccess={() => { refetch(); setMostrarForm(false); }} />
          </div>
        )}

        {/* Tabla con filtros */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-md border-b border-slate-100 flex flex-wrap gap-3 items-center">
            <h3 className="font-headline-sm text-on-surface mr-auto">Historial de Gastos</h3>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="todos">Todas las categorías</option>
              {CATEGORIAS.map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}
              className="border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="todos">Todos los estados</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
          <TablaGastos rows={filtered} loading={loading} />
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-sm text-outline">
              Mostrando {filtered.length} de {gastos.length} gastos
            </p>
          </div>
        </div>
      </Layout>
    </>
  );
}
