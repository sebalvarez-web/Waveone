import { useState, useEffect } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";
import type { Corredor, Plan, CorredorEmail } from "@/types/database";
import { usePausas } from "@/hooks/usePausas";
import { MESES_ES } from "@/lib/deudas";

interface EmailAdicional {
  email: string;
  etiqueta: string;
}

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

  const { pausas, addPausa, removePausa } = usePausas(corredor?.id);
  const [nuevaPausa, setNuevaPausa] = useState({
    mes: new Date().getMonth() + 1,
    año: new Date().getFullYear(),
    tarifa_mantenimiento: 0,
  });
  const [addingPausa, setAddingPausa] = useState(false);

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
  const [emailsAdicionales, setEmailsAdicionales] = useState<EmailAdicional[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!corredor?.id) return;
    supabase
      .from("corredor_emails")
      .select("*")
      .eq("corredor_id", corredor.id)
      .then(({ data }) => {
        if (data) {
          setEmailsAdicionales(
            (data as CorredorEmail[]).map((e) => ({
              email: e.email,
              etiqueta: e.etiqueta ?? "",
            }))
          );
        }
      });
  }, [corredor?.id, supabase]);

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

    let corredorId = corredor?.id;

    if (isEditing) {
      const estaDesactivando =
        form.estado === "inactivo" && corredor.estado !== "inactivo";

      if (estaDesactivando) {
        const response = await fetch(`/api/corredores/${corredor.id}/desactivar`, {
          method: "POST",
        });
        if (!response.ok) {
          toast.error("Error al desactivar el corredor");
          setLoading(false);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { estado: _estado, ...restoPayload } = payload;
        const { error } = await supabase
          .from("corredores")
          .update(restoPayload)
          .eq("id", corredor.id);
        if (error) {
          toast.error("Error al actualizar datos del corredor");
          setLoading(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from("corredores")
          .update(payload)
          .eq("id", corredor.id);
        if (error) {
          toast.error("Error al guardar el corredor");
          setLoading(false);
          return;
        }
      }
    } else {
      const { data, error } = await supabase
        .from("corredores")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Error al guardar el corredor");
        setLoading(false);
        return;
      }
      corredorId = data.id;
    }

    if (isEditing) {
      await supabase
        .from("corredor_emails")
        .delete()
        .eq("corredor_id", corredor.id);
    }

    const emailsValidos = emailsAdicionales.filter((e) => e.email.trim());
    if (emailsValidos.length > 0) {
      const { error: emailErr } = await supabase.from("corredor_emails").insert(
        emailsValidos.map((e) => ({
          corredor_id: corredorId,
          email: e.email.trim(),
          etiqueta: e.etiqueta.trim() || null,
        }))
      );
      if (emailErr) {
        toast.error("Corredor guardado pero hubo un error al guardar los emails adicionales");
      }
    }

    setLoading(false);
    toast.success(isEditing ? "Corredor actualizado" : "Corredor añadido");
    onSuccess();
    onClose();
  };

  const field = (key: string) => ({
    value: (form as Record<string, unknown>)[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const addEmail = () =>
    setEmailsAdicionales((prev) => [...prev, { email: "", etiqueta: "" }]);

  const removeEmail = (index: number) =>
    setEmailsAdicionales((prev) => prev.filter((_, i) => i !== index));

  const updateEmail = (index: number, field: keyof EmailAdicional, value: string) =>
    setEmailsAdicionales((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
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
            <label className="block font-label-caps text-outline mb-1 text-xs">CORREO PRINCIPAL *</label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              {...field("email")}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {errors.email && <p className="text-error text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-label-caps text-outline text-xs">CORREOS ADICIONALES</label>
              <button
                type="button"
                onClick={addEmail}
                aria-label="Agregar correo"
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:opacity-80"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Agregar correo
              </button>
            </div>
            {emailsAdicionales.map((entry, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="email"
                  placeholder="Email adicional"
                  value={entry.email}
                  onChange={(e) => updateEmail(i, "email", e.target.value)}
                  className="flex-1 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Etiqueta"
                  value={entry.etiqueta}
                  onChange={(e) => updateEmail(i, "etiqueta", e.target.value)}
                  className="w-28 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => removeEmail(i)}
                  aria-label="Eliminar correo"
                  className="text-outline hover:text-error"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>

          {isEditing && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-label-caps text-outline text-xs">MESES DE PAUSA</label>
                <button
                  type="button"
                  onClick={() => setAddingPausa(!addingPausa)}
                  className="flex items-center gap-1 text-xs text-primary font-semibold hover:opacity-80"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Agregar pausa
                </button>
              </div>

              {addingPausa && (
                <div className="flex gap-2 mb-3 p-3 bg-slate-50 rounded-lg">
                  <select
                    value={nuevaPausa.mes}
                    onChange={(e) => setNuevaPausa(p => ({ ...p, mes: Number(e.target.value) }))}
                    className="flex-1 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  >
                    {MESES_ES.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Año"
                    value={nuevaPausa.año}
                    onChange={(e) => setNuevaPausa(p => ({ ...p, año: Number(e.target.value) }))}
                    className="w-24 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    placeholder="Tarifa ($)"
                    value={nuevaPausa.tarifa_mantenimiento}
                    onChange={(e) => setNuevaPausa(p => ({ ...p, tarifa_mantenimiento: Number(e.target.value) }))}
                    className="w-28 border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await addPausa(nuevaPausa.mes, nuevaPausa.año, nuevaPausa.tarifa_mantenimiento);
                      setAddingPausa(false);
                    }}
                    className="bg-primary text-white rounded-lg px-3 py-2 text-sm font-semibold"
                  >
                    Guardar
                  </button>
                </div>
              )}

              <div className="space-y-1">
                {pausas.length === 0 && (
                  <p className="text-xs text-outline italic">Sin meses de pausa registrados.</p>
                )}
                {pausas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="text-on-surface">
                      {MESES_ES[p.mes - 1]} {p.año}
                      {p.tarifa_mantenimiento > 0 && (
                        <span className="text-outline ml-2">(${p.tarifa_mantenimiento} mantenimiento)</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePausa(p.id)}
                      className="text-outline hover:text-error"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
