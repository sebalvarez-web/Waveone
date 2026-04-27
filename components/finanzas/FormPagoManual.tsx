import { useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";
import type { Corredor } from "@/types/database";

interface FormPagoManualProps {
  corredores: Pick<Corredor, "id" | "nombre">[];
  onSuccess: () => void;
}

export function FormPagoManual({ corredores, onSuccess }: FormPagoManualProps) {
  const supabase = useSupabaseClient();
  const [form, setForm] = useState({
    descripcion: "",
    corredor_id: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
    metodo: "transferencia",
    referencia: "",
    categoria: "membresia",
    aplicar_a_mes: "", // formato "YYYY-M" (vacío = automático al adeudo más viejo)
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion || !form.monto) return;
    setLoading(true);

    const { data: tx, error } = await supabase
      .from("transacciones")
      .insert({
        tipo: "ingreso",
        descripcion: form.descripcion,
        corredor_id: form.corredor_id || null,
        monto: Number(form.monto),
        fecha: form.fecha,
        metodo: form.metodo,
        categoria: form.categoria,
        estado: "pagado",
      })
      .select("id")
      .single();

    if (error) { setLoading(false); toast.error("Error al registrar el pago"); return; }

    // Aplicar a mes de adeudo más antiguo (o al mes específico seleccionado)
    if (tx?.id && form.corredor_id) {
      const override = form.aplicar_a_mes;
      const [y, m] = override ? override.split("-").map(Number) : [null, null];
      const { error: rpcErr } = await supabase.rpc("aplicar_pago", {
        p_transaccion_id: tx.id,
        p_corredor_id: form.corredor_id,
        p_monto: Number(form.monto),
        p_mes_override: m,
        p_anio_override: y,
      });
      if (rpcErr) toast.error("Pago registrado pero no se aplicó a mes adeudado");
    }

    setLoading(false);
    toast.success("Pago registrado");
    onSuccess();
    setForm({ ...form, descripcion: "", monto: "", corredor_id: "", referencia: "", aplicar_a_mes: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">CORREDOR (opcional)</label>
          <select
            value={form.corredor_id}
            onChange={(e) => setForm((p) => ({ ...p, corredor_id: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3"
          >
            <option value="">Sin corredor asignado</option>
            {corredores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">DESCRIPCIÓN *</label>
          <input
            type="text"
            placeholder="descripción del pago"
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            required
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">CANTIDAD *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="number"
              placeholder="0.00"
              value={form.monto}
              onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
              min="0"
              step="0.01"
              required
              className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 pl-7 pr-3"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">FECHA</label>
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3"
          />
        </div>
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">MÉTODO</label>
          <select
            value={form.metodo}
            onChange={(e) => setForm((p) => ({ ...p, metodo: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3"
          >
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="font-label-caps text-on-surface-variant block text-xs">
          APLICAR A MES (opcional — vacío = adeudo más antiguo)
        </label>
        <input
          type="month"
          value={form.aplicar_a_mes ? form.aplicar_a_mes.replace(/-(\d)$/, "-0$1") : ""}
          onChange={(e) => {
            const v = e.target.value; // "YYYY-MM"
            if (!v) { setForm((p) => ({ ...p, aplicar_a_mes: "" })); return; }
            const [y, m] = v.split("-").map(Number);
            setForm((p) => ({ ...p, aplicar_a_mes: `${y}-${m}` }));
          }}
          className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-60 text-sm"
      >
        {loading ? "Registrando..." : "Registrar Pago"}
      </button>
    </form>
  );
}
