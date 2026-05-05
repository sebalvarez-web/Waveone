import Head from "next/head";
import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { PagosSinAsignar } from "@/components/pagos/PagosSinAsignar";
import { GraficaPagos } from "@/components/pagos/GraficaPagos";
import { ModalEditarTransaccion } from "@/components/finanzas/ModalEditarTransaccion";
import { useTransacciones } from "@/hooks/useTransacciones";
import { useCorredores } from "@/hooks/useCorredores";
import { usePagosAplicados } from "@/hooks/usePagosAplicados";
import { MESES_ES } from "@/lib/deudas";
import type { Transaccion } from "@/types/database";

// Map transaccion_id → ordered list of "Ene '25" labels for /pagos APLICADO A column.
type AplicadosMap = Map<string, string>;

// Wave One accent palette (used on top of light surfaces)
const A = {
  coral:  "#FF5E3A",
  teal:   "#00C9A7",
  lime:   "#7DA800",
  gray:   "#8A8578",
  stripe: "#635BFF",
  paypal: "#009CDE",
};

type Tab = "todos" | "stripe" | "paypal" | "manual" | "sin_asignar";
type SortKey = "fecha_desc" | "fecha_asc" | "monto_desc" | "monto_asc" | "corredor_az";

function sortPagos(rows: Transaccion[], key: SortKey): Transaccion[] {
  const arr = [...rows];
  switch (key) {
    case "fecha_desc": arr.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)); break;
    case "fecha_asc":  arr.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)); break;
    case "monto_desc": arr.sort((a, b) => Number(b.monto) - Number(a.monto)); break;
    case "monto_asc":  arr.sort((a, b) => Number(a.monto) - Number(b.monto)); break;
    case "corredor_az":
      arr.sort((a, b) => (a.corredor?.nombre ?? "~").localeCompare(b.corredor?.nombre ?? "~"));
      break;
  }
  return arr;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FUENTE_CFG: Record<string, { label: string; color: string }> = {
  stripe:        { label: "Stripe",         color: A.stripe },
  paypal:        { label: "PayPal",          color: A.paypal },
  transferencia: { label: "Transferencia",   color: A.teal },
  efectivo:      { label: "Efectivo",        color: A.gray },
};

const ESTADO_CFG: Record<string, { label: string; color: string }> = {
  pagado:      { label: "Pagado",      color: A.teal },
  pendiente:   { label: "Pendiente",   color: A.coral },
  vencido:     { label: "Vencido",     color: "#DC2626" },
  reembolsado: { label: "Reembolsado", color: A.lime },
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 4,
      background: color + "18",
      border: `1px solid ${color}35`,
      color,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
    }}>
      {children}
    </span>
  );
}

function BadgeFuente({ metodo }: { metodo: string }) {
  const cfg = FUENTE_CFG[metodo] ?? { label: metodo, color: A.gray };
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}

function BadgeEstado({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? { label: estado, color: A.gray };
  return (
    <Badge color={cfg.color}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </Badge>
  );
}

function TablaPagos({ rows, loading, onEdit, aplicados }: { rows: Transaccion[]; loading: boolean; onEdit: (t: Transaccion) => void; aplicados: AplicadosMap }) {
  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[1,2,3,4,5].map(i => <div key={i} className="h-11 bg-surface-container-low rounded-lg animate-pulse" />)}
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
    <div className="overflow-auto max-h-[60vh]">
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0 z-10 bg-surface-container-low">
          <tr className="border-b border-outline-variant/50 text-left">
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">FECHA</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">CORREDOR</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">DESCRIPCIÓN</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">ID / REFERENCIA</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">FUENTE</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">ESTADO</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant">APLICADO A</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant text-right">COMISIÓN</th>
            <th className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant text-right">MONTO</th>
            <th className="px-5 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40">
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-surface-container-low/60 transition-colors">
              <td className="px-5 py-3.5 text-on-surface-variant whitespace-nowrap font-mono text-xs">
                {new Date(t.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </td>
              <td className="px-5 py-3.5 text-on-surface font-semibold">
                {t.corredor?.nombre ?? <span className="text-outline italic font-normal">Sin asignar</span>}
              </td>
              <td className="px-5 py-3.5 text-on-surface-variant">
                <span title={t.descripcion ?? ""} className="block max-w-[240px] truncate">{t.descripcion}</span>
              </td>
              <td className="px-5 py-3.5 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                {t.stripe_payment_id ? (
                  <a
                    href={`https://dashboard.stripe.com/invoices/${t.stripe_payment_id}`}
                    target="_blank" rel="noopener noreferrer"
                    title={t.stripe_payment_id}
                    style={{ color: A.stripe }}
                    className="hover:underline"
                  >
                    {t.stripe_payment_id.slice(0, 14)}…
                  </a>
                ) : t.paypal_order_id ? (
                  <a
                    href={`https://www.paypal.com/activity/payment/${t.paypal_order_id}`}
                    target="_blank" rel="noopener noreferrer"
                    title={t.paypal_order_id}
                    style={{ color: A.paypal }}
                    className="hover:underline"
                  >
                    {t.paypal_order_id.slice(0, 14)}…
                  </a>
                ) : (
                  <span className="text-outline">—</span>
                )}
              </td>
              <td className="px-5 py-3.5"><BadgeFuente metodo={t.metodo} /></td>
              <td className="px-5 py-3.5"><BadgeEstado estado={t.estado} /></td>
              <td className="px-5 py-3.5 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                {aplicados.get(t.id) ?? (
                  t.estado === "pagado" && t.corredor_id
                    ? <span title="Pago sin asignar a mes — verificar aplicar_pago" className="text-error">⚠ —</span>
                    : <span className="text-outline">—</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-on-surface-variant text-xs">
                {Number(t.comision) > 0 ? `-$${fmt(Number(t.comision))}` : <span className="text-outline">—</span>}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-on-surface font-bold text-[13px]">
                ${fmt(Number(t.monto))}
              </td>
              <td className="px-3 py-3.5">
                <button
                  onClick={() => onEdit(t)}
                  className="p-1 rounded hover:bg-surface-container-low text-outline hover:text-on-surface transition-colors"
                  title="Editar"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KpiCard({ label, total, count, sub, color, highlight }: {
  label: string; total: number; count: number; sub?: string;
  color: string; highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-soft relative overflow-hidden"
      style={{
        border: highlight ? `1.5px solid ${color}50` : "1px solid rgba(0,0,0,0.07)",
        boxShadow: highlight ? `0 4px 20px ${color}18` : undefined,
      }}>
      {highlight && (
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${color}10 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
      )}
      <div className="flex items-center gap-2 mb-3">
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0,
          boxShadow: `0 0 6px ${color}80`,
        }} />
        <p className="text-[10px] font-extrabold tracking-[0.1em]" style={{ color }}>
          {label}
        </p>
      </div>
      <p className="font-headline font-extrabold text-on-surface tabular-nums"
        style={{ fontSize: 26, letterSpacing: "-0.03em", lineHeight: 1 }}>
        ${fmt(total)}
      </p>
      <p className="text-[11px] text-on-surface-variant mt-2">
        {count} {sub ?? "cobros"}
      </p>
    </div>
  );
}

type SyncStatus = "idle" | "loading" | "ok" | "error";

async function runSync(days = 30): Promise<{ stats: Record<string, number> }> {
  const [stripeRes, paypalRes] = await Promise.all([
    fetch(`/api/sync/stripe?days=${days}`, { method: "POST" }),
    fetch(`/api/sync/paypal?days=${days}`, { method: "POST" }),
  ]);
  const stripe = await stripeRes.json();
  const paypal = await paypalRes.json();
  return {
    stats: {
      stripe_synced: stripe.stats?.synced ?? 0,
      stripe_sin_asignar: stripe.stats?.sin_asignar ?? 0,
      paypal_synced: paypal.stats?.synced ?? 0,
      paypal_sin_asignar: paypal.stats?.sin_asignar ?? 0,
    },
  };
}

export default function PagosPage() {
  const { transacciones, loading, refetch } = useTransacciones({ fetchAll: true, tipo: "ingreso" });
  const { corredores } = useCorredores();
  const { pagosAplicados } = usePagosAplicados();
  // Group pa rows by transaccion_id, sort oldest-first, format as "Ene '25, Feb '25".
  const aplicadosByTx = useMemo<AplicadosMap>(() => {
    const grouped = new Map<string, { año: number; mes: number }[]>();
    for (const pa of pagosAplicados) {
      const arr = grouped.get(pa.transaccion_id) ?? [];
      arr.push({ año: pa.año, mes: pa.mes });
      grouped.set(pa.transaccion_id, arr);
    }
    const out: AplicadosMap = new Map();
    for (const [txId, arr] of grouped) {
      arr.sort((a, b) => a.año - b.año || a.mes - b.mes);
      out.set(txId, arr.map(m => `${MESES_ES[m.mes - 1]} '${String(m.año).slice(-2)}`).join(", "));
    }
    return out;
  }, [pagosAplicados]);
  const [tab, setTab] = useState<Tab>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("fecha_desc");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncResult, setSyncResult] = useState<Record<string, number> | null>(null);
  const [editando, setEditando] = useState<Transaccion | null>(null);
  const [mesFilter, setMesFilter] = useState<string>("todos");
  const [sinAsignarCount, setSinAsignarCount] = useState<number | null>(null);

  const fetchSinAsignarCount = async () => {
    try {
      const res = await fetch("/api/pagos/sin-asignar");
      if (!res.ok) return;
      const data = await res.json();
      setSinAsignarCount(Array.isArray(data) ? data.length : null);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchSinAsignarCount(); }, []);

  const handleSync = async () => {
    setSyncStatus("loading");
    setSyncResult(null);
    try {
      const { stats } = await runSync(60);
      setSyncResult(stats);
      setSyncStatus("ok");
      refetch();
    } catch {
      setSyncStatus("error");
    }
  };

  const WITHDRAWAL_KEYWORDS = ["retirado", "withdrawal", "retiro", "funds withdrawn", "fondos retirados"];
  const ingresos = transacciones.filter(t =>
    t.tipo === "ingreso" &&
    !WITHDRAWAL_KEYWORDS.some(kw => t.descripcion?.toLowerCase().includes(kw))
  );

  // Build sorted unique month options from all income records
  const mesesDisponibles = Array.from(
    new Set(ingresos.map(t => t.fecha.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const byMes = (rows: Transaccion[]) =>
    mesFilter === "todos" ? rows : rows.filter(t => t.fecha.slice(0, 7) === mesFilter);

  const ingresosFiltered = byMes(ingresos);

  const totalStripe      = ingresosFiltered.filter(t => t.metodo === "stripe").reduce((s, t) => s + Number(t.monto), 0);
  const totalPaypal      = ingresosFiltered.filter(t => t.metodo === "paypal").reduce((s, t) => s + Number(t.monto), 0);
  const totalManual      = ingresosFiltered.filter(t => t.metodo === "transferencia" || t.metodo === "efectivo").reduce((s, t) => s + Number(t.monto), 0);
  const totalConsolidado = totalStripe + totalPaypal + totalManual;

  const filtered: Record<Tab, Transaccion[]> = {
    todos:       ingresosFiltered,
    stripe:      ingresosFiltered.filter(t => t.metodo === "stripe"),
    paypal:      ingresosFiltered.filter(t => t.metodo === "paypal"),
    manual:      ingresosFiltered.filter(t => t.metodo === "transferencia" || t.metodo === "efectivo"),
    sin_asignar: [],
  };

  const TABS: { id: Tab; label: string; count?: number; color: string }[] = [
    { id: "todos",       label: "Todos",          count: ingresosFiltered.length,  color: A.coral },
    { id: "stripe",      label: "Stripe",          count: filtered.stripe.length,  color: A.stripe },
    { id: "paypal",      label: "PayPal",          count: filtered.paypal.length,  color: A.paypal },
    { id: "manual",      label: "Manual / Banco",  count: filtered.manual.length,  color: A.teal },
    { id: "sin_asignar", label: "Sin asignar", count: sinAsignarCount ?? undefined, color: "#DC2626" },
  ];

  return (
    <>
      <Head><title>Wave One — Pagos</title></Head>
      <Layout>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-label-caps mb-2" style={{ color: A.coral }}>
              WAVE ONE — FINANZAS
            </p>
            <h2 className="text-headline-lg text-on-background font-headline">Pagos</h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              Consolidado de ingresos por Stripe, PayPal y entradas bancarias.
            </p>
          </div>

          {/* Month filter + Sync */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_month</span>
              <select
                value={mesFilter}
                onChange={e => setMesFilter(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-sm font-semibold text-on-surface focus:outline-none bg-white cursor-pointer"
              >
                <option value="todos">Todos los meses</option>
                {mesesDisponibles.map(m => {
                  const [year, month] = m.split("-");
                  const label = new Date(Number(year), Number(month) - 1, 1)
                    .toLocaleDateString("es-MX", { month: "long", year: "numeric" });
                  return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                })}
              </select>
              {mesFilter !== "todos" && (
                <button
                  onClick={() => setMesFilter("todos")}
                  title="Limpiar filtro"
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={syncStatus === "loading"}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: syncStatus === "loading" ? `${A.coral}18` : A.coral,
                color: syncStatus === "loading" ? A.coral : "#1a1a1a",
                border: `1.5px solid ${A.coral}`,
                opacity: syncStatus === "loading" ? 0.7 : 1,
              }}
            >
              <span className="material-symbols-outlined text-[17px]" style={{
                animation: syncStatus === "loading" ? "spin 1s linear infinite" : "none",
              }}>sync</span>
              {syncStatus === "loading" ? "Sincronizando…" : "Sincronizar"}
            </button>
            {syncStatus === "ok" && syncResult && (
              <p className="text-[11px]" style={{ color: A.teal }}>
                ✓ Stripe: {syncResult.stripe_synced} nuevos · PayPal: {syncResult.paypal_synced} nuevos
                {(syncResult.stripe_sin_asignar + syncResult.paypal_sin_asignar) > 0 &&
                  ` · ${syncResult.stripe_sin_asignar + syncResult.paypal_sin_asignar} sin asignar`}
              </p>
            )}
            {syncStatus === "error" && (
              <p className="text-[11px] text-error">Error al sincronizar. Revisa las variables de entorno.</p>
            )}
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard label="STRIPE"            total={totalStripe}      count={filtered.stripe.length} color={A.stripe} />
          <KpiCard label="PAYPAL"            total={totalPaypal}      count={filtered.paypal.length} color={A.paypal} />
          <KpiCard label="MANUAL / BANCO"    total={totalManual}      count={filtered.manual.length} sub="entradas" color={A.teal} />
          <KpiCard label="TOTAL CONSOLIDADO" total={totalConsolidado} count={ingresos.length} sub="transacciones" color={A.coral} highlight />
        </div>

        <GraficaPagos transacciones={transacciones} />

        {/* Table card */}
        <div className="bg-white border border-outline-variant/60 rounded-xl overflow-hidden shadow-soft">
          {/* Tab bar */}
          <div className="flex border-b border-outline-variant/40 overflow-x-auto bg-surface-container-low/50">
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                    active ? "text-on-surface bg-white" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      padding: "1px 6px", borderRadius: 4,
                      background: active ? t.color + "18" : "transparent",
                      color: active ? t.color : undefined,
                      border: active ? `1px solid ${t.color}35` : "none",
                    }} className={active ? "" : "text-on-surface-variant"}>
                      {t.count}
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: t.color }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Sort bar */}
          {tab !== "sin_asignar" && (
            <div className="px-4 py-2.5 border-b border-outline-variant/40 bg-white flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">sort</span>
              <span className="text-[11px] font-bold tracking-wider text-on-surface-variant">ORDENAR</span>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant focus:outline-none bg-white cursor-pointer"
                style={{ focusRingColor: A.coral } as React.CSSProperties}
              >
                <option value="fecha_desc">Fecha (más reciente)</option>
                <option value="fecha_asc">Fecha (más antigua)</option>
                <option value="monto_desc">Monto (mayor)</option>
                <option value="monto_asc">Monto (menor)</option>
                <option value="corredor_az">Corredor A–Z</option>
              </select>
              <span className="ml-auto text-[11px] text-on-surface-variant">
                {filtered[tab].length} resultados
              </span>
            </div>
          )}

          {tab === "sin_asignar" ? (
            <div className="overflow-auto max-h-[60vh] p-5">
              <PagosSinAsignar corredores={corredores} onReconciliado={() => { refetch(); fetchSinAsignarCount(); }} />
            </div>
          ) : (
            <TablaPagos rows={sortPagos(filtered[tab], sortKey)} loading={loading} onEdit={setEditando} aplicados={aplicadosByTx} />
          )}
        </div>
      </Layout>

      {editando && (
        <ModalEditarTransaccion
          transaccion={editando}
          onClose={() => setEditando(null)}
          onSuccess={() => { setEditando(null); refetch(); }}
        />
      )}
    </>
  );
}
