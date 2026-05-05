import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Transaccion } from "@/types/database";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const COLORS = { stripe: "#635BFF", paypal: "#009CDE", manual: "#059669" };

function buildData(transacciones: Transaccion[]) {
  const map = new Map<string, { mes: string; stripe: number; paypal: number; manual: number }>();
  for (const t of transacciones) {
    if (t.tipo !== "ingreso") continue;
    const d = new Date(t.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { mes: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, stripe: 0, paypal: 0, manual: 0 });
    const row = map.get(key)!;
    if (t.metodo === "stripe") row.stripe += Number(t.monto);
    else if (t.metodo === "paypal") row.paypal += Number(t.monto);
    else row.manual += Number(t.monto);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).slice(-12);
}

function TooltipCustom({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-outline-variant rounded-lg shadow-elev p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-on-surface mb-2">{label}</p>
      {payload.map(p => p.value > 0 && (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-data-mono">${p.value.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
        </div>
      ))}
      <div className="border-t border-outline-variant/40 mt-2 pt-2 flex justify-between gap-4 font-semibold">
        <span className="text-on-surface-variant">Total</span>
        <span className="font-data-mono text-on-surface">${total.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}

export function GraficaPagos({ transacciones }: { transacciones: Transaccion[] }) {
  const data = buildData(transacciones);
  if (data.length === 0) return null;
  return (
    <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft mb-4">
      <div className="mb-4">
        <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">INGRESOS POR MÉTODO EN EL TIEMPO</p>
        <p className="text-xs text-outline mt-0.5">Últimos 12 meses</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gStripe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.stripe} stopOpacity={0.15} />
              <stop offset="95%" stopColor={COLORS.stripe} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gPaypal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.paypal} stopOpacity={0.15} />
              <stop offset="95%" stopColor={COLORS.paypal} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gManual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.manual} stopOpacity={0.15} />
              <stop offset="95%" stopColor={COLORS.manual} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E9E9E2" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94A0B5" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => "$" + (v >= 1000 ? (v/1000).toFixed(0)+"k" : v)} tick={{ fontSize: 11, fill: "#94A0B5" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<TooltipCustom />} cursor={{ stroke: "#E9E9E2", strokeWidth: 1 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Area type="monotone" dataKey="stripe" name="Stripe" stroke={COLORS.stripe} strokeWidth={2} fill="url(#gStripe)" dot={false} />
          <Area type="monotone" dataKey="paypal" name="PayPal" stroke={COLORS.paypal} strokeWidth={2} fill="url(#gPaypal)" dot={false} />
          <Area type="monotone" dataKey="manual" name="Manual" stroke={COLORS.manual} strokeWidth={2} fill="url(#gManual)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
