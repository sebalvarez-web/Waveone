import Head from "next/head";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PagosSinAsignar } from "@/components/pagos/PagosSinAsignar";
import { useTransacciones } from "@/hooks/useTransacciones";
import { useCorredores } from "@/hooks/useCorredores";
import type { Transaccion } from "@/types/database";

type Tab = "todos" | "stripe" | "paypal" | "manual" | "sin_asignar";

const FUENTE_BADGE: Record<string, { label: string; color: string }> = {
  stripe:       { label: "Stripe",       color: "bg-[#635bff] text-white" },
  paypal:       { label: "PayPal",       color: "bg-[#0070ba] text-white" },
  transferencia:{ label: "Transferencia",color: "bg-secondary text-white" },
  efectivo:     { label: "Efectivo",     color: "bg-slate-500 text-white" },
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BadgeFuente({ metodo }: { metodo: string }) {
  const b = FUENTE_BADGE[metodo] ?? { label: metodo, color: "bg-slate-300 text-on-surface" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${b.color}`}>
      {b.label}
    </span>
  );
}

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    pagado:   "bg-secondary/10 text-secondary",
    pendiente:"bg-yellow-100 text-yellow-700",
    vencido:  "bg-red-100 text-red-600",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${map[estado] ?? "bg-slate-100 text-slate-600"}`}>
      {estado}
    </span>
  );
}

function TablaPagos({ rows, loading }: { rows: Transaccion[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-outline text-sm">Sin registros para este filtro.</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left">
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Fecha</th>
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Corredor</th>
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Descripción</th>
            <th className="px-4 py-3 text-label-caps text-on-surface-variant font-semibold">Fuente</th>
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
              <td className="px-4 py-3 text-on-surface font-medium">
                {t.corredor?.nombre ?? <span className="text-outline italic">Sin asignar</span>}
              </td>
              <td className="px-4 py-3 text-on-surface-variant max-w-xs truncate">{t.descripcion}</td>
              <td className="px-4 py-3"><BadgeFuente metodo={t.metodo} /></td>
              <td className="px-4 py-3"><BadgeEstado estado={t.estado} /></td>
              <td className="px-4 py-3 text-right font-data-mono text-on-surface font-semibold">
                ${fmt(Number(t.monto))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PagosPage() {
  const { transacciones, loading, refetch } = useTransacciones({ limit: 500 });
  const { corredores } = useCorredores();
  const [tab, setTab] = useState<Tab>("todos");

  const ingresos = transacciones.filter(t => t.tipo === "ingreso");

  const totalStripe       = ingresos.filter(t => t.metodo === "stripe").reduce((s,t) => s + Number(t.monto), 0);
  const totalPaypal       = ingresos.filter(t => t.metodo === "paypal").reduce((s,t) => s + Number(t.monto), 0);
  const totalManual       = ingresos.filter(t => t.metodo === "transferencia" || t.metodo === "efectivo").reduce((s,t) => s + Number(t.monto), 0);
  const totalConsolidado  = totalStripe + totalPaypal + totalManual;

  const filtered: Record<Tab, Transaccion[]> = {
    todos:       ingresos,
    stripe:      ingresos.filter(t => t.metodo === "stripe"),
    paypal:      ingresos.filter(t => t.metodo === "paypal"),
    manual:      ingresos.filter(t => t.metodo === "transferencia" || t.metodo === "efectivo"),
    sin_asignar: [],
  };

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "todos",       label: "Todos",         count: ingresos.length },
    { id: "stripe",      label: "Stripe",        count: filtered.stripe.length },
    { id: "paypal",      label: "PayPal",        count: filtered.paypal.length },
    { id: "manual",      label: "Manual/Banco",  count: filtered.manual.length },
    { id: "sin_asignar", label: "Sin Asignar" },
  ];

  return (
    <>
      <Head><title>RunTeam Pro — Pagos</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-on-background font-headline">Pagos</h2>
          <p className="text-body-lg text-on-surface-variant">
            Consolidado de ingresos por Stripe, PayPal y entradas bancarias manuales.
          </p>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">STRIPE</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#635bff]" />
              <span className="text-headline-sm font-headline text-on-surface">${fmt(totalStripe)}</span>
            </div>
            <p className="text-[11px] text-outline mt-1">{filtered.stripe.length} cobros</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">PAYPAL</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0070ba]" />
              <span className="text-headline-sm font-headline text-on-surface">${fmt(totalPaypal)}</span>
            </div>
            <p className="text-[11px] text-outline mt-1">{filtered.paypal.length} cobros</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">MANUAL / BANCO</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-headline-sm font-headline text-on-surface">${fmt(totalManual)}</span>
            </div>
            <p className="text-[11px] text-outline mt-1">{filtered.manual.length} entradas</p>
          </div>
          <div className="bg-primary text-white rounded-xl p-md">
            <p className="text-label-caps text-white/70 mb-1">TOTAL CONSOLIDADO</p>
            <span className="text-headline-sm font-headline">${fmt(totalConsolidado)}</span>
            <p className="text-[11px] text-white/60 mt-1">{ingresos.length} transacciones</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full ${
                    tab === t.id ? "bg-primary/10 text-primary" : "bg-slate-100 text-outline"
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "sin_asignar" ? (
            <div className="p-md">
              <PagosSinAsignar corredores={corredores} onReconciliado={refetch} />
            </div>
          ) : (
            <TablaPagos rows={filtered[tab]} loading={loading} />
          )}
        </div>
      </Layout>
    </>
  );
}
