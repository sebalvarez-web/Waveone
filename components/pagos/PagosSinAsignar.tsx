import { useState, useEffect } from "react";
import { toast } from "@/components/ui/Toast";
import type { PagoSinAsignar, Corredor } from "@/types/database";

interface PagosSinAsignarProps {
  corredores: Pick<Corredor, "id" | "nombre">[];
  onReconciliado: () => void;
}

export function PagosSinAsignar({ corredores, onReconciliado }: PagosSinAsignarProps) {
  const [pagos, setPagos] = useState<PagoSinAsignar[]>([]);
  const [loading, setLoading] = useState(true);
  const [asignando, setAsignando] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});

  const fetchPagos = async () => {
    const res = await fetch("/api/pagos/sin-asignar");
    const data = await res.json();
    setPagos(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchPagos(); }, []);

  const handleReconciliar = async (pagoId: string) => {
    const corredorId = seleccion[pagoId];
    if (!corredorId) { toast.error("Selecciona un corredor primero"); return; }

    setAsignando(pagoId);
    const res = await fetch("/api/pagos/sin-asignar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pago_id: pagoId, corredor_id: corredorId }),
    });

    setAsignando(null);
    if (!res.ok) { toast.error("Error al reconciliar el pago"); return; }
    toast.success("Pago asignado correctamente");
    fetchPagos();
    onReconciliado();
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (pagos.length === 0) {
    return (
      <div className="bg-secondary/10 text-secondary rounded-xl p-6 text-center">
        <span className="material-symbols-outlined text-2xl mb-2">check_circle</span>
        <p className="text-sm font-semibold">No hay pagos pendientes de asignar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pagos.map((pago) => (
        <div
          key={pago.id}
          className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
              pago.fuente === "stripe" ? "bg-[#635bff]" : "bg-[#0070ba]"
            }`}
          >
            {pago.fuente === "stripe" ? "S" : "P"}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-on-surface capitalize">{pago.fuente}</p>
            <p className="text-xs text-outline">
              {new Date(pago.fecha).toLocaleDateString("es-MX")} •{" "}
              <span className="font-data-mono">${Number(pago.monto).toFixed(2)}</span>
            </p>
          </div>
          <select
            value={seleccion[pago.id] ?? ""}
            onChange={(e) => setSeleccion((p) => ({ ...p, [pago.id]: e.target.value }))}
            className="border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          >
            <option value="">Seleccionar corredor...</option>
            {corredores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <button
            onClick={() => handleReconciliar(pago.id)}
            disabled={asignando === pago.id || !seleccion[pago.id]}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {asignando === pago.id ? "Asignando..." : "Asignar"}
          </button>
        </div>
      ))}
    </div>
  );
}
