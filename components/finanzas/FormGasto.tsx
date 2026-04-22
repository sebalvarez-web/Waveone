import { useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";

interface FormGastoProps {
  onSuccess: () => void;
}

export function FormGasto({ onSuccess }: FormGastoProps) {
  const supabase = useSupabaseClient();
  const [form, setForm] = useState({
    descripcion: "",
    categoria: "instalaciones",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion || !form.monto) return;
    setLoading(true);

    const { error } = await supabase.from("transacciones").insert({
      tipo: "gasto",
      descripcion: form.descripcion,
      categoria: form.categoria,
      monto: Number(form.monto),
      fecha: form.fecha,
      metodo: "transferencia",
      estado: "pendiente",
    });

    setLoading(false);
    if (error) { toast.error("Error al registrar el gasto"); return; }
    toast.success("Gasto registrado");
    onSuccess();
    setForm({ ...form, descripcion: "", monto: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="font-label-caps text-on-surface-variant block text-xs">DESCRIPCIÓN *</label>
        <input
          type="text"
          placeholder="ej., Alquiler de Pista - Estadio Local"
          value={form.descripcion}
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
          required
          className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2 px-3"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">CATEGORÍA</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3"
          >
            <option value="instalaciones">Alquiler de Instalaciones</option>
            <option value="equipamiento">Equipamiento</option>
            <option value="viaje">Viaje y Alojamiento</option>
            <option value="marketing">Marketing</option>
            <option value="otro">Otro</option>
          </select>
        </div>
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
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-tertiary text-white rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-60 text-sm"
      >
        {loading ? "Enviando..." : "Enviar Gasto"}
      </button>
    </form>
  );
}
