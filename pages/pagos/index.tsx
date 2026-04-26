import Head from "next/head";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PagosSinAsignar } from "@/components/pagos/PagosSinAsignar";
import { useTransacciones } from "@/hooks/useTransacciones";
import { useCorredores } from "@/hooks/useCorredores";
import type { Transaccion } from "@/types/database";

type Tab = "todos" | "stripe" | "paypal" | "manual" | "sin_asignar";

const FUENTE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  stripe:        { label: "Stripe",        bg: "bg-[#635bff]/10",   text: "text-[#635bff]" },
  paypal:        { label: "PayPal",        bg: "bg-[#0070ba]/10",   text: "text-[#0070ba]" },
  transferencia: { label: "Transferencia", bg: "bg-secondary-container", text: "text-on-secondary-container" },
  efectivo:      { label: "Efectivo",      bg: "bg-surface-container",   text: "text-on-surface-variant" },
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BadgeFuente({ metodo }: { metodo: string }) {
  const b = FUENTE_BADGE[metodo] ?? { label: metodo, bg: "bg-surface-container", text: "text-on-surface-variant" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.bg} ${b.text}`}>
      {b.label}
    </span>
  );
}

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    pagado:      { bg: "bg-secondary-container", text: "text-on-secondary-container", dot: "bg-secondary",  label: "Pagado" },
    pendiente:   { bg: "bg-tertiary-container",  text: "text-on-tertiary-container",  dot: "bg-tertiary",   label: "Pendiente" },
    vencido:     { bg: "bg-error-container",     text: "text-on-error-container",     dot: "bg-error",      label: "Vencido" },
    reembolsado: { bg: "bg-info-container",      text: "text-info",                   dot: "bg-info",       label: "Reembolsado" },
  };
  const cfg = map[estado] ?? { bg: "bg-surface-container", text: "text-on-surface-variant", dot: "bg-outline", label: estado };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TablaPagos({ rows, loading }: { rows: Transaccion[]; loading: boolean }) {
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
          <p className="text-sm">Sin registros para este filtro.</p>
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
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">CORREDOR</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">DESCRIPCIÓN</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">FUENTE</th>
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
              <td className="px-5 py-3.5 text-on-surface font-semibold">
                {t.corredor?.nombre ?? <span className="text-outline italic font-normal">Sin asignar</span>}
              </td>
              <td className="px-5 py-3.5 text-on-surface-variant max-w-xs truncate">{t.descripcion}</td>
              <td className="px-5 py-3.5"><BadgeFuente metodo={t.metodo} /></td>
              <td className="px-5 py-3.5"><BadgeEstado estado={t.estado} /></td>
              <td className="px-5 py-3.5 text-right font-mono text-on-surface font-semibold">
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

  const TABS: { id: Tab; label: string; count?: number; icon: string }[] = [
    { id: "todos",       label: "Todos",        count: ingresos.length,         icon: "list" },
    { id: "stripe",      label: "Stripe",       count: filtered.stripe.length,  icon: "credit_card" },
    { id: "paypal",      label: "PayPal",       count: filtered.paypal.length,  icon: "account_balance" },
    { id: "manual",      label: "Manual/Banco", count: filtered.manual.length,  icon: "account_balance_wallet" },
    { id: "sin_asignar", label: "Sin asignar",                                  icon: "warning" },
  ];

  return (
    <>
      <Head><title>Wave One — Pagos</title></Head>
      <Layout>
        <div className="mb-6">
          <p className="text-label-caps text-on-surface-variant mb-2">FINANZAS</p>
          <h2 className="text-headline-lg text-on-background font-headline">Pagos</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Consolidado de ingresos por Stripe, PayPal y entradas bancarias manuales.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiPago color="#635bff" label="STRIPE" total={totalStripe} count={filtered.stripe.length} />
          <KpiPago color="#0070ba" label="PAYPAL" total={totalPaypal} count={filtered.paypal.length} />
          <KpiPago color="#059669" label="MANUAL / BANCO" total={totalManual} count={filtered.manual.length} sub="entradas" />
          <div className="bg-primary text-white rounded-xl p-4 shadow-soft relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-accent/20 blur-2xl" />
            <p className="text-[10px] font-bold tracking-wider text-white/70 relative">TOTAL CONSOLIDADO</p>
            <p className="text-3xl font-headline font-bold mt-2 tabular-nums tracking-tight relative">
              ${fmt(totalConsolidado)}
            </p>
            <p className="text-[11px] text-white/60 mt-1 relative">{ingresos.length} transacciones</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-outline-variant/60 rounded-xl overflow-hidden shadow-soft">
          <div className="flex border-b border-outline-variant/40 overflow-x-auto bg-surface-container-low/40">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                  tab === t.id
                    ? "text-on-surface bg-white"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                {t.label}
                {t.count !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.id ? "bg-accent-soft text-accent" : "bg-surface-container text-on-surface-variant"
                  }`}>
                    {t.count}
                  </span>
                )}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                )}
              </button>
            ))}
          </div>

          {tab === "sin_asignar" ? (
            <div className="p-5">
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

function KpiPago({ color, label, total, count, sub }: { color: string; label: string; total: number; count: number; sub?: string }) {
  return (
    <div className="bg-white border border-outline-variant/60 rounded-xl p-4 shadow-soft">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">{label}</p>
      </div>
      <p className="text-2xl font-headline font-bold text-on-surface tabular-nums tracking-tight">
        ${fmt(total)}
      </p>
      <p className="text-[11px] text-on-surface-variant mt-1">
        {count} {sub ?? "cobros"}
      </p>
    </div>
  );
}
