import { useEffect, useMemo, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";
import { CATEGORIAS_GASTO } from "@/lib/categorias";

interface FormGastoProps {
  onSuccess: () => void;
}

interface GastoMemoria {
  pagado_a: string;
  categoria: string | null;
  descripcion: string | null;
  fecha: string;
}

export function FormGasto({ onSuccess }: FormGastoProps) {
  const supabase = useSupabaseClient();
  const [form, setForm] = useState({
    descripcion: "",
    pagado_a: "",
    categoria: CATEGORIAS_GASTO[0].slug,
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);
  const [memoria, setMemoria] = useState<GastoMemoria[]>([]);

  // Carga el "diccionario" de destinatarios + último uso por destinatario
  useEffect(() => {
    supabase
      .from("transacciones")
      .select("pagado_a, categoria, descripcion, fecha")
      .eq("tipo", "gasto")
      .not("pagado_a", "is", null)
      .order("fecha", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setMemoria(data as GastoMemoria[]);
      });
  }, [supabase]);

  // Sugerencias únicas (último valor por nombre, ya que viene ordenado por fecha desc)
  const sugerencias = useMemo(() => {
    const seen = new Set<string>();
    const out: GastoMemoria[] = [];
    for (const m of memoria) {
      const key = (m.pagado_a ?? "").trim();
      if (!key) continue;
      const k = key.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }
    return out;
  }, [memoria]);

  // Auto-fill al elegir un destinatario conocido
  const handlePagadoAChange = (value: string) => {
    setForm((p) => ({ ...p, pagado_a: value }));
    const match = sugerencias.find(
      (s) => s.pagado_a.trim().toLowerCase() === value.trim().toLowerCase()
    );
    if (match) {
      setForm((p) => ({
        ...p,
        pagado_a: value,
        categoria: match.categoria || p.categoria,
        descripcion: p.descripcion || match.descripcion || "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion || !form.monto) return;
    setLoading(true);

    const { error } = await supabase.from("transacciones").insert({
      tipo: "gasto",
      descripcion: form.descripcion,
      pagado_a: form.pagado_a.trim() || null,
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
    setForm({ ...form, descripcion: "", monto: "", pagado_a: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">PAGADO A</label>
          <input
            type="text"
            list="pagado-a-sugerencias"
            placeholder="ej., Estadio Local S.A."
            value={form.pagado_a}
            onChange={(e) => handlePagadoAChange(e.target.value)}
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2 px-3"
          />
          <datalist id="pagado-a-sugerencias">
            {sugerencias.map((s) => (
              <option key={s.pagado_a} value={s.pagado_a} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">DESCRIPCIÓN *</label>
          <input
            type="text"
            placeholder="ej., Alquiler de Pista"
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            required
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2 px-3"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="font-label-caps text-on-surface-variant block text-xs">CATEGORÍA</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3"
          >
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
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
