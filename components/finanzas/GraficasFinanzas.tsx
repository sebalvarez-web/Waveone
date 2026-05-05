import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PieAny = Pie as any;
import { useState } from "react";
import type { Transaccion } from "@/types/database";

const CORAL  = "#FF5E3A";
const EMERALD = "#059669";
const AMBER  = "#D97706";
const MESES  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function buildMensual(transacciones: Transaccion[]) {
  // Últimos 3 meses calendario (incluyendo el actual).
  const now = new Date();
  const keysOrdenadas: string[] = [];
  const init = new Map<string, { mes: string; ingresos: number; gastos: number }>();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    keysOrdenadas.push(key);
    init.set(key, { mes: label, ingresos: 0, gastos: 0 });
  }
  for (const t of transacciones) {
    const d = new Date(t.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = init.get(key);
    if (!row) continue;
    if (t.tipo === "ingreso") row.ingresos += Number(t.monto);
    else row.gastos += Number(t.monto);
  }
  return keysOrdenadas.map(k => init.get(k)!);
}

function buildMetodo(transacciones: Transaccion[]) {
  // Últimos 30 días.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const map = new Map<string, number>();
  for (const t of transacciones) {
    if (t.tipo !== "ingreso") continue;
    if (new Date(t.fecha) < cutoff) continue;
    const k = t.metodo ?? "otro";
    map.set(k, (map.get(k) ?? 0) + Number(t.monto));
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
}

const METODO_COLORS: Record<string, string> = {
  Stripe: "#635BFF",
  Paypal: "#009CDE",
  Transferencia: EMERALD,
  Efectivo: AMBER,
  Otro: "#94A0B5",
};

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-outline-variant rounded-lg shadow-elev p-3 text-sm min-w-[140px]">
      <p className="font-semibold text-on-surface mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-data-mono">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function renderActiveShape(props: PieSectorDataItem) {
  const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill = "", payload, percent = 0, value = 0 } = props as PieSectorDataItem & { payload: { name: string }; percent: number };
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#0B1220" className="text-sm font-semibold" fontSize={13} fontWeight={600}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#5A6478" fontSize={12}>
        {fmt(value)}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#94A0B5" fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={(outerRadius as number) + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={(innerRadius as number) - 4} outerRadius={innerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

export function GraficasFinanzas({ transacciones }: { transacciones: Transaccion[] }) {
  const mensual = buildMensual(transacciones);
  const metodo  = buildMetodo(transacciones);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Barras: ingresos vs gastos por mes */}
      <div className="lg:col-span-2 bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft">
        <div className="mb-4">
          <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">INGRESOS VS GASTOS</p>
          <p className="text-xs text-outline mt-0.5">Últimos 3 meses</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={mensual} barCategoryGap="30%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E9E9E2" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94A0B5" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => "$" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} tick={{ fontSize: 11, fill: "#94A0B5" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="ingresos" name="Ingresos" fill={EMERALD} radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos"   name="Gastos"   fill={CORAL}   radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Dona: desglose por método */}
      <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft flex flex-col">
        <div className="mb-4">
          <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">INGRESOS POR MÉTODO</p>
          <p className="text-xs text-outline mt-0.5">Últimos 30 días</p>
        </div>
        {metodo.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-outline">Sin datos</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <PieAny
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={metodo}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  dataKey="value"
                  onMouseEnter={(_: PieSectorDataItem, i: number) => setActiveIndex(i)}
                >
                  {metodo.map((entry) => (
                    <Cell key={entry.name} fill={METODO_COLORS[entry.name] ?? "#94A0B5"} />
                  ))}
                </PieAny>
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {metodo.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: METODO_COLORS[m.name] ?? "#94A0B5" }} />
                    <span className="text-on-surface-variant">{m.name}</span>
                  </div>
                  <span className="font-data-mono text-on-surface">{fmt(m.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
