import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useCorredores } from "@/hooks/useCorredores";
import { useTransacciones } from "@/hooks/useTransacciones";
import { usePagosAplicados } from "@/hooks/usePagosAplicados";
import { usePausasAll } from "@/hooks/usePausasAll";
import { calcularDeudas, MESES_ES, type MesEstado } from "@/lib/deudas";

type SortKey = "deuda_desc" | "deuda_asc" | "nombre" | "monto_desc" | "estatus";

const CELDA: Record<MesEstado, string> = {
  pagado: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  deuda:  "bg-red-50 text-red-700 ring-1 ring-red-200",
  pausa:  "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  futuro: "bg-slate-50 text-slate-300 ring-1 ring-slate-100",
};

const CELDA_ICON: Record<MesEstado, string> = {
  pagado: "check",
  deuda:  "close",
  pausa:  "pause",
  futuro: "remove",
};

const TOOLTIP: Record<MesEstado, string> = {
  pagado: "Pagado",
  deuda:  "Adeudado",
  pausa:  "Pausado",
  futuro: "Pendiente",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lastMonths(n: number) {
  const result = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push({ year: ref.getFullYear(), month: ref.getMonth() });
  }
  return result;
}

const COLS = lastMonths(12);

export default function DeudasPage() {
  const [search, setSearch] = useState("");
  const { corredores, loading: loadingC } = useCorredores();
  const { transacciones, loading: loadingT } = useTransacciones({ soloIngresoPagado: true });
  const { pagosAplicados } = usePagosAplicados();
  const { pausas } = usePausasAll();
  const [soloConDeuda, setSoloConDeuda] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("deuda_desc");

  const deudas = useMemo(
    () => calcularDeudas(corredores, transacciones, pausas, pagosAplicados),
    [corredores, transacciones, pausas, pagosAplicados]
  );

  const filtradas = useMemo(() => {
    const list = deudas.filter(d => {
      const matchSearch = d.corredor.nombre.toLowerCase().includes(search.toLowerCase());
      const matchDeuda = !soloConDeuda || d.mesesDeudaCount > 0;
      return matchSearch && matchDeuda;
    });
    const sorted = [...list];
    switch (sortKey) {
      case "deuda_desc":
        sorted.sort((a, b) => b.mesesDeudaCount - a.mesesDeudaCount || b.totalDeuda - a.totalDeuda);
        break;
      case "deuda_asc":
        sorted.sort((a, b) => a.mesesDeudaCount - b.mesesDeudaCount || a.totalDeuda - b.totalDeuda);
        break;
      case "nombre":
        sorted.sort((a, b) => a.corredor.nombre.localeCompare(b.corredor.nombre));
        break;
      case "monto_desc":
        sorted.sort((a, b) => b.totalDeuda - a.totalDeuda);
        break;
      case "estatus": {
        // 0 = con deuda, 1 = pausado, 2 = al corriente
        const rank = (d: typeof sorted[number]) => {
          if (d.mesesDeudaCount > 0) return 0;
          const ultimo = [...d.meses].reverse().find(m => m.estado !== "futuro");
          if (ultimo?.estado === "pausa") return 1;
          return 2;
        };
        sorted.sort((a, b) => {
          const ra = rank(a);
          const rb = rank(b);
          if (ra !== rb) return ra - rb;
          if (ra === 0) return b.mesesDeudaCount - a.mesesDeudaCount || b.totalDeuda - a.totalDeuda;
          return a.corredor.nombre.localeCompare(b.corredor.nombre);
        });
        break;
      }
    }
    return sorted;
  }, [deudas, search, soloConDeuda, sortKey]);

  const totalDeudaGlobal = deudas.reduce((s, d) => s + d.totalDeuda, 0);
  const corredoresConDeuda = deudas.filter(d => d.mesesDeudaCount > 0).length;
  const totalMesesAdeudados = deudas.reduce((s, d) => s + d.mesesDeudaCount, 0);
  const corredoresAlCorriente = deudas.length - corredoresConDeuda;
  const pctAlCorriente = deudas.length > 0
    ? Math.round((corredoresAlCorriente / deudas.length) * 100)
    : 0;

  const loading = loadingC || loadingT;

  return (
    <>
      <Head><title>Wave One — Deudas</title></Head>
      <Layout>
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-label-caps text-outline mb-1">FINANZAS</p>
            <h2 className="text-headline-lg text-on-background font-headline">Control de Deudas</h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              Historial mensual de pagos por corredor — datos en vivo.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 ring-1 ring-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700">En vivo</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="DEUDA TOTAL"
            value={`$${fmt(totalDeudaGlobal)}`}
            icon="payments"
            tone="danger"
            sub={totalDeudaGlobal > 0 ? "Por cobrar" : "Sin deuda"}
            loading={loading}
          />
          <KpiCard
            label="CORREDORES CON DEUDA"
            value={String(corredoresConDeuda)}
            icon="person_alert"
            tone="warning"
            sub={`de ${deudas.length} totales`}
            loading={loading}
          />
          <KpiCard
            label="MESES ADEUDADOS"
            value={String(totalMesesAdeudados)}
            icon="event_busy"
            tone="neutral"
            sub="acumulados"
            loading={loading}
          />
          <KpiCard
            label="AL CORRIENTE"
            value={`${pctAlCorriente}%`}
            icon="verified"
            tone="success"
            sub={`${corredoresAlCorriente} corredores`}
            loading={loading}
            progress={pctAlCorriente}
          />
        </div>

        {/* Tabla card */}
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center bg-gradient-to-b from-slate-50/60 to-white">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar corredor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-64 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all bg-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setSoloConDeuda(!soloConDeuda)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                soloConDeuda
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                  : "bg-white text-on-surface-variant ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-sm">filter_alt</span>
              Solo con deuda
              {soloConDeuda && (
                <span className="material-symbols-outlined text-sm ml-0.5">close</span>
              )}
            </button>

            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface-variant focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all bg-white cursor-pointer"
            >
              <option value="deuda_desc">Más meses adeudados</option>
              <option value="deuda_asc">Menos meses adeudados</option>
              <option value="monto_desc">Mayor monto adeudado</option>
              <option value="estatus">Estatus</option>
              <option value="nombre">Nombre A-Z</option>
            </select>

            <div className="ml-auto hidden md:flex items-center gap-3 text-[11px] text-outline">
              <Legend color="bg-emerald-100 ring-emerald-200" label="Pagado" />
              <Legend color="bg-red-100 ring-red-200" label="Adeudado" />
              <Legend color="bg-slate-100 ring-slate-200" label="Pausa" />
              <Legend color="bg-slate-50 ring-slate-100" label="Pendiente" />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="h-10 w-44 bg-slate-100 rounded animate-pulse" />
                  <div className="h-8 flex-1 bg-slate-50 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-[11px] tracking-wider text-on-surface-variant font-semibold uppercase sticky left-0 bg-slate-50/95 backdrop-blur z-10 min-w-[220px]">
                      Corredor
                    </th>
                    {COLS.map(({ year, month }) => {
                      const isFirstOfYear = month === 0;
                      return (
                        <th
                          key={`${year}-${month}`}
                          className={`px-1 py-3 text-center text-[11px] text-on-surface-variant font-semibold uppercase min-w-[52px] ${
                            isFirstOfYear ? "border-l border-slate-200" : ""
                          }`}
                        >
                          {MESES_ES[month]}
                          <br />
                          <span className="text-[10px] text-outline font-normal tracking-wider">&apos;{String(year).slice(2)}</span>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right text-[11px] tracking-wider text-on-surface-variant font-semibold uppercase min-w-[140px]">
                      Deuda
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={COLS.length + 2} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                          <p className="text-sm text-outline">No hay corredores que coincidan.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtradas.map(({ corredor, meses, totalDeuda, mesesDeudaCount }) => (
                    <tr key={corredor.id} className="border-b border-slate-100 group hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-slate-50/95 z-10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {corredor.nombre.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/corredores/${corredor.id}`}
                              className="font-semibold text-on-surface hover:text-primary transition-colors block truncate"
                            >
                              {corredor.nombre}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-outline truncate">
                                {corredor.plan?.nombre ?? "Sin plan"}
                              </span>
                              {mesesDeudaCount > 0 && (
                                <span className="inline-flex items-center text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold ring-1 ring-red-200">
                                  {mesesDeudaCount}m
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {COLS.map(({ year, month }) => {
                        const mes = meses.find(m => m.year === year && m.month === month);
                        const estado = mes?.estado ?? "futuro";
                        const [iy, im] = corredor.fecha_ingreso.split("T")[0].split("-").map(Number);
                        const antesDeIngreso = new Date(iy, im - 1, 1) > new Date(year, month + 1, 0);
                        const isFirstOfYear = month === 0;
                        if (antesDeIngreso) {
                          return (
                            <td
                              key={`${year}-${month}`}
                              className={`px-1 py-3 text-center ${isFirstOfYear ? "border-l border-slate-100" : ""}`}
                            >
                              <span className="inline-block w-7 h-7" />
                            </td>
                          );
                        }
                        return (
                          <td
                            key={`${year}-${month}`}
                            className={`px-1 py-3 text-center ${isFirstOfYear ? "border-l border-slate-100" : ""}`}
                          >
                            <span
                              title={TOOLTIP[estado]}
                              className={`inline-flex w-7 h-7 rounded-md items-center justify-center transition-transform hover:scale-110 ${CELDA[estado]}`}
                            >
                              <span className="material-symbols-outlined text-[14px] font-bold leading-none">
                                {CELDA_ICON[estado]}
                              </span>
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-semibold">
                        {totalDeuda > 0 ? (
                          <span className="text-red-600">${fmt(totalDeuda)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Al corriente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!loading && filtradas.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs text-on-surface-variant">
              <span>
                Mostrando <span className="font-semibold text-on-surface">{filtradas.length}</span> de{" "}
                <span className="font-semibold text-on-surface">{deudas.length}</span> corredores
              </span>
              <span className="hidden sm:inline">Últimos 12 meses</span>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  tone: "danger" | "warning" | "success" | "neutral";
  sub?: string;
  loading?: boolean;
  progress?: number;
}

function KpiCard({ label, value, icon, tone, sub, loading, progress }: KpiCardProps) {
  const tones = {
    danger:  { bg: "bg-red-50",      ring: "ring-red-100",      text: "text-red-700",     icon: "text-red-500",     accent: "bg-red-500" },
    warning: { bg: "bg-amber-50",    ring: "ring-amber-100",    text: "text-amber-700",   icon: "text-amber-500",   accent: "bg-amber-500" },
    success: { bg: "bg-emerald-50",  ring: "ring-emerald-100",  text: "text-emerald-700", icon: "text-emerald-500", accent: "bg-emerald-500" },
    neutral: { bg: "bg-white",       ring: "ring-slate-200",    text: "text-on-surface",  icon: "text-outline",     accent: "bg-slate-400" },
  }[tone];

  if (loading) {
    return (
      <div className={`relative rounded-xl ${tones.bg} ring-1 ${tones.ring} p-4 overflow-hidden`}>
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse mb-3" />
        <div className="h-7 w-32 bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl ${tones.bg} ring-1 ${tones.ring} p-4 overflow-hidden transition-shadow hover:shadow-sm`}>
      <div className="flex items-start justify-between mb-2">
        <p className={`text-[11px] tracking-wider font-semibold ${tones.text} opacity-80`}>{label}</p>
        <span className={`material-symbols-outlined text-xl ${tones.icon}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-headline font-semibold ${tones.text}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-on-surface-variant mt-1">{sub}</p>
      )}
      {typeof progress === "number" && (
        <div className="mt-3 h-1 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full ${tones.accent} rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded ring-1 ${color}`} />
      {label}
    </span>
  );
}
