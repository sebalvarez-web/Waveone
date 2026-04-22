import { useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";
import type { Corredor, Plan } from "@/types/database";

interface FormCorredorProps {
  corredor?: Corredor;
  planes: Plan[];
  onClose: () => void;
  onSuccess: () => void;
}

export function FormCorredor({ corredor, planes, onClose, onSuccess }: FormCorredorProps) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const isEditing = !!corredor;

  const [form, setForm] = useState({
    nombre: corredor?.nombre ?? "",
    email: corredor?.email ?? "",
    telefono_emergencia: corredor?.telefono_emergencia ?? "",
    fecha_ingreso: corredor?.fecha_ingreso ?? new Date().toISOString().split("T")[0],
    plan_id: corredor?.plan_id ?? "",
    estado: corredor?.estado ?? "activo",
    uniforme_entregado: corredor?.uniforme_entregado ?? false,
    proxima_carrera: corredor?.proxima_carrera ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido";
    if (!form.email.trim()) e.email = "El correo es requerido";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Correo inválido";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    const payload = {
      ...form,
      plan_id: form.plan_id || null,
      entrenador_id: corredor?.entrenador_id ?? user!.id,
    };

    const { error } = isEditing
      ? await supabase.from("corredores").update(payload).eq("id", corredor.id)
      : await supabase.from("corredores").insert(payload);

    setLoading(false);

    if (error) {
      toast.error("Error al guardar el corredor");
      return;
    }

    toast.success(isEditing ? "Corredor actualizado" : "Corredor añadido");
    onSuccess();
    onClose();
  };

  const field = (key: string) => ({
    value: (form as Record<string, unknown>)[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-headline-sm text-on-surface">
            {isEditing ? "Editar Corredor" : "Añadir Corredor"}
          </h3>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">NOMBRE *</label>
            <input
              type="text"
              placeholder="Nombre completo"
              {...field("nombre")}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.nombre && <p className="text-error text-xs mt-1">{errors.nombre}</p>}
          </div>

          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">CORREO *</label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              {...field("email")}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.email && <p className="text-error text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">TELÉFONO EMERGENCIA</label>
              <input
                type="tel"
                placeholder="+52 55 1234 5678"
                {...field("telefono_emergencia")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">FECHA INGRESO</label>
              <input
                type="date"
                {...field("fecha_ingreso")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">PLAN</label>
              <select
                {...field("plan_id")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Sin plan</option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (${p.precio_mensual}/mes)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label-caps text-outline mb-1 text-xs">ESTADO</label>
              <select
                {...field("estado")}
                className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="activo">Activo</option>
                <option value="pausado">Pausado</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">PRÓXIMA CARRERA</label>
            <input
              type="text"
              placeholder="ej. Maratón CDMX 2024"
              {...field("proxima_carrera")}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.uniforme_entregado}
              onChange={(e) => setForm((p) => ({ ...p, uniforme_entregado: e.target.checked }))}
              className="rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span className="text-sm text-on-surface">Uniforme entregado</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-outline-variant rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
