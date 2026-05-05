import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Transaccion } from "@/types/database";
import { CATEGORIAS_GASTO, CATEGORIAS_GASTO_SLUGS, CATEGORIAS_GASTO_COLORS, CATEGORIAS_GASTO_LABELS } from "@/lib/categorias";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CATEGORIAS = CATEGORIAS_GASTO_SLUGS;
const COLORS = CATEGORIAS_GASTO_COLORS;
const FALLBACK = "otros";

const SLUG_LOOKUP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const c of CATEGORIAS_GASTO) {
    m[c.slug.toLowerCase()] = c.slug;
    m[c.label.toLowerCase()] = c.slug;
  }
  // alias legacy
  m["otro"] = "otros";
  m["personal"] = "sueldos";
  m["operativo"] = "consumibles";
  m["legal"] = "legales_consultoria";
  m["legales"] = "legales_consultoria";
  m["consultoria"] = "legales_consultoria";
  return m;
})();

function normalizarCategoria(raw: string | null | undefined): string {
  if (!raw) return FALLBACK;
  return SLUG_LOOKUP[String(raw).trim().toLowerCase()] ?? FALLBACK;
}

type Row = { mes: string; [key: string]: string | number };

function buildData(transacciones: Transaccion[]): Row[] {
  const map = new Map<string, Row>();
  for (const t of transacciones) {
    if (t.tipo !== "gasto") continue;
    const d = new Date(t.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) {
      const row: Row = { mes: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` };
      CATEGORIAS.forEach(c => { row[c] = 0; });
      map.set(key, row);
    }
    const row = map.get(key)!;
    const cat = normalizarCategoria(t.categoria as string);
    row[cat] = (row[cat] as number) + Number(t.monto);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).slice(-12);
}

function TooltipCustom({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  const items = payload.filter(p => p.value > 0);
  return (
    <div className="bg-white border border-outline-variant rounded-lg shadow-elev p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-on-surface mb-2 capitalize">{label}</p>
      {items.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill }}>{CATEGORIAS_GASTO_LABELS[p.name] ?? p.name}</span>
          <span className="font-data-mono">${p.value.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div className="border-t border-outline-variant/40 mt-2 pt-2 flex justify-between gap-4 font-semibold">
          <span className="text-on-surface-variant">Total</span>
          <span className="font-data-mono text-on-surface">${total.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        </div>
      )}
    </div>
  );
}

export function GraficaGastos({ transacciones }: { transacciones: Transaccion[] }) {
  const data = buildData(transacciones);
  if (data.length === 0) return null;
  const categoriasActivas = CATEGORIAS.filter(c => data.some(r => Number(r[c]) > 0));
  const ultima = categoriasActivas[categoriasActivas.length - 1];
  return (
    <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft mb-6">
      <div className="mb-4">
        <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">GASTOS POR CATEGORÍA EN EL TIEMPO</p>
        <p className="text-xs text-outline mt-0.5">Últimos 12 meses</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E9E9E2" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94A0B5" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => "$" + (v >= 1000 ? (v/1000).toFixed(0)+"k" : v)} tick={{ fontSize: 11, fill: "#94A0B5" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<TooltipCustom />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={v => <span>{CATEGORIAS_GASTO_LABELS[v] ?? v}</span>} />
          {categoriasActivas.map(cat => (
            <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={COLORS[cat]}
              radius={cat === ultima ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
