import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useCorredores } from "@/hooks/useCorredores";
import { useTransacciones } from "@/hooks/useTransacciones";
import { calcularDeudas, MESES_ES, type MesEstado } from "@/lib/deudas";

const CELDA: Record<MesEstado, string> = {
  pagado: "bg-secondary/20 text-secondary",
  deuda:  "bg-red-100 text-red-600",
  futuro: "bg-slate-100 text-slate-300",
};

const TOOLTIP: Record<MesEstado, string> = {
  pagado: "Pagado",
  deuda:  "Adeudado",
  futuro: "Pendiente",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Last N months for the column headers
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
  const { transacciones, loading: loadingT } = useTransacciones({ limit: 1000 });
  const [soloConDeuda, setSoloConDeuda] = useState(false);

  const deudas = useMemo(() => calcularDeudas(corredores, transacciones), [corredores, transacciones]);

  const filtradas = deudas.filter(d => {
    const matchSearch = d.corredor.nombre.toLowerCase().includes(search.toLowerCase());
    const matchDeuda = !soloConDeuda || d.mesesDeudaCount > 0;
    return matchSearch && matchDeuda;
  });

  const totalDeudaGlobal = deudas.reduce((s, d) => s + d.totalDeuda, 0);
  const corredoresConDeuda = deudas.filter(d => d.mesesDeudaCount > 0).length;
  const totalMesesAdeudados = deudas.reduce((s, d) => s + d.mesesDeudaCount, 0);

  const loading = loadingC || loadingT;

  return (
    <>
      <Head><title>Wave One — Deudas</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-on-background font-headline">Control de Deudas</h2>
          <p className="text-body-lg text-on-surface-variant">
            Historial de pagos por mes para cada corredor activo.
          </p>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-gutter mb-8">
          <div className="bg-red-50 border border-red-100 rounded-xl p-md">
            <p className="text-label-caps text-red-400 mb-1">DEUDA TOTAL</p>
            <span className="text-headline-sm font-headline text-red-600">${fmt(totalDeudaGlobal)}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">CORREDORES CON DEUDA</p>
            <span className="text-headline-sm font-headline text-on-surface">{corredoresConDeuda}</span>
            <p className="text-[11px] text-outline mt-1">de {deudas.length} activos</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-md">
            <p className="text-label-caps text-on-surface-variant mb-1">MESES ADEUDADOS</p>
            <span className="text-headline-sm font-headline text-on-surface">{totalMesesAdeudados}</span>
            <p className="text-[11px] text-outline mt-1">en total</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="p-md border-b border-slate-100 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Buscar corredor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary w-56"
            />
            <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloConDeuda}
                onChange={e => setSoloConDeuda(e.target.checked)}
                className="rounded"
              />
              Solo con deuda
            </label>
            <div className="ml-auto flex items-center gap-4 text-[11px] text-outline">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-secondary/20 inline-block" />Pagado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-100 inline-block" />Adeudado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-slate-100 inline-block" />Sin iniciar
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-label-caps text-on-surface-variant font-semibold sticky left-0 bg-white z-10 min-w-[180px]">
                      Corredor
                    </th>
                    {COLS.map(({ year, month }) => (
                      <th key={`${year}-${month}`} className="px-1 py-3 text-center text-label-caps text-on-surface-variant font-semibold min-w-[48px]">
                        {MESES_ES[month]}<br />
                        <span className="text-[10px] text-outline font-normal">{String(year).slice(2)}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-label-caps text-on-surface-variant font-semibold min-w-[120px]">
                      Deuda Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={COLS.length + 2} className="px-4 py-10 text-center text-outline text-sm">
                        No hay corredores que coincidan.
                      </td>
                    </tr>
                  )}
                  {filtradas.map(({ corredor, meses, totalDeuda, mesesDeudaCount }) => (
                    <tr key={corredor.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 z-10">
                        <Link href={`/corredores/${corredor.id}`} className="font-medium text-on-surface hover:text-primary transition-colors">
                          {corredor.nombre}
                        </Link>
                        {mesesDeudaCount > 0 && (
                          <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">
                            {mesesDeudaCount} mes{mesesDeudaCount > 1 ? "es" : ""}
                          </span>
                        )}
                        <p className="text-[11px] text-outline mt-0.5">{corredor.plan?.nombre ?? "Sin plan"}</p>
                      </td>
                      {COLS.map(({ year, month }) => {
                        const mes = meses.find(m => m.year === year && m.month === month);
                        const estado = mes?.estado ?? "futuro";
                        // Corredor hadn't joined yet
                        const antesDeIngreso = new Date(corredor.fecha_ingreso) > new Date(year, month + 1, 0);
                        if (antesDeIngreso) {
                          return <td key={`${year}-${month}`} className="px-1 py-3 text-center" />;
                        }
                        return (
                          <td key={`${year}-${month}`} className="px-1 py-3 text-center" title={TOOLTIP[estado]}>
                            <span className={`inline-flex w-8 h-6 rounded items-center justify-center text-[10px] font-bold ${CELDA[estado]}`}>
                              {estado === "pagado" ? "✓" : estado === "deuda" ? "✗" : "·"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-data-mono font-semibold">
                        {totalDeuda > 0
                          ? <span className="text-red-600">${fmt(totalDeuda)}</span>
                          : <span className="text-secondary text-sm">Al corriente</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
