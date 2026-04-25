import { useState } from "react";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { toast } from "@/components/ui/Toast";

interface ModalNotaHistorialProps {
  corredorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ModalNotaHistorial({ corredorId, onClose, onSuccess }: ModalNotaHistorialProps) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nota.trim()) {
      setError("La nota es requerida");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.from("corredor_historial").insert([
      {
        corredor_id: corredorId,
        tipo: "nota",
        nota: nota.trim(),
        fecha: new Date(fecha).toISOString(),
        creado_por: user?.id ?? null,
      },
    ]);
    setLoading(false);

    if (err) {
      toast.error("Error al guardar la nota");
      return;
    }

    toast.success("Nota registrada");
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-headline-sm text-on-surface">Registrar Evento</h3>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">FECHA</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block font-label-caps text-outline mb-1 text-xs">NOTA *</label>
            <textarea
              placeholder="Escribe una nota sobre este corredor..."
              value={nota}
              onChange={(e) => {
                setNota(e.target.value);
                if (error) setError("");
              }}
              rows={4}
              className="w-full border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
            {error && <p className="text-error text-xs mt-1">{error}</p>}
          </div>
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
