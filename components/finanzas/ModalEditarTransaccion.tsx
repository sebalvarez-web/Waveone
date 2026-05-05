import { useState, useEffect } from "react";
import { toast } from "@/components/ui/Toast";
import { CATEGORIAS_GASTO } from "@/lib/categorias";
import type { Transaccion, TransaccionEstado, TransaccionMetodo } from "@/types/database";

interface Props {
  transaccion: Transaccion;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIAS_INGRESO = ["membresia", "inscripcion", "otro"];
const ESTADOS = ["pagado", "pendiente", "vencido", "reembolsado"];
const METODOS = ["stripe", "paypal", "transferencia", "efectivo"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold tracking-wider text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-outline-variant focus:border-primary focus:outline-none text-sm py-2 px-3 bg-white";

export function ModalEditarTransaccion({ transaccion: tx, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    descripcion: tx.descripcion ?? "",
    monto: String(tx.monto),
    fecha: tx.fecha,
    categoria: tx.categoria ?? "",
    estado: tx.estado,
    metodo: tx.metodo,
    comision: String(tx.comision ?? 0),
    comision_impuesto: String(tx.comision_impuesto ?? 0),
    pagado_a: tx.pagado_a ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/transacciones/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: form.descripcion,
          monto: Number(form.monto),
          fecha: form.fecha,
          categoria: form.categoria,
          estado: form.estado,
          metodo: form.metodo,
          comision: Number(form.comision),
          comision_impuesto: Number(form.comision_impuesto),
          pagado_a: form.pagado_a.trim() || null,
        }),
      });
      if (!res.ok) { toast.error("Error al guardar"); return; }
      toast.success("Cambios guardados");
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      `¿Borrar esta ${esIngreso ? "transacción de pago" : "transacción"} por $${Number(form.monto).toFixed(2)}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/transacciones/${tx.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Error al borrar");
        return;
      }
      toast.success("Transacción borrada");
      onSuccess();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const categorias: Array<{ slug: string; label: string }> =
    tx.tipo === "ingreso"
      ? CATEGORIAS_INGRESO.map((c) => ({ slug: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
      : CATEGORIAS_GASTO.map((c) => ({ slug: c.slug, label: c.label }));
  const esIngreso = tx.tipo === "ingreso";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/50">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">
              {esIngreso ? "PAGO" : "GASTO"}
            </p>
            <h3 className="text-base font-semibold text-on-surface mt-0.5">Editar transacción</h3>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Field label="DESCRIPCIÓN">
            <input
              type="text"
              value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              className={INPUT}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="MONTO">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={form.monto}
                  onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                  className={INPUT + " pl-7"}
                />
              </div>
            </Field>
            <Field label="FECHA">
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                className={INPUT}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CATEGORÍA">
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className={INPUT}>
                {categorias.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="ESTADO">
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value as TransaccionEstado }))} className={INPUT}>
                {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
            </Field>
          </div>

          {!esIngreso && (
            <Field label="PAGADO A">
              <input
                type="text"
                value={form.pagado_a}
                onChange={e => setForm(p => ({ ...p, pagado_a: e.target.value }))}
                placeholder="ej., Estadio Local S.A."
                className={INPUT}
              />
            </Field>
          )}

          <Field label="MÉTODO DE PAGO">
            <select value={form.metodo} onChange={e => setForm(p => ({ ...p, metodo: e.target.value as TransaccionMetodo }))} className={INPUT}>
              {METODOS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </Field>

          {esIngreso && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="COMISIÓN">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.comision}
                    onChange={e => setForm(p => ({ ...p, comision: e.target.value }))}
                    className={INPUT + " pl-7"}
                  />
                </div>
              </Field>
              <Field label="IVA COMISIÓN">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.comision_impuesto}
                    onChange={e => setForm(p => ({ ...p, comision_impuesto: e.target.value }))}
                    className={INPUT + " pl-7"}
                  />
                </div>
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/50 flex justify-between items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-error border border-error/40 hover:bg-error/5 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            {deleting ? "Borrando..." : "Borrar"}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="px-5 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              style={{ background: "#C8FF00", color: "#1a1a1a" }}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
