import type { Transaccion } from "@/types/database";

interface TablaTransaccionesProps {
  transacciones: Transaccion[];
  loading: boolean;
  onRefund?: (id: string) => Promise<void>;
}

const ESTADO_BADGE: Record<string, string> = {
  pagado: "bg-secondary/10 text-secondary",
  vencido: "bg-tertiary/10 text-tertiary",
  pendiente: "bg-primary/10 text-primary",
  reembolsado: "bg-slate-100 text-slate-500",
};

const FUENTE_DOT: Record<string, string> = {
  stripe: "bg-[#635bff]",
  paypal: "bg-[#0070ba]",
  transferencia: "bg-slate-400",
  efectivo: "bg-slate-300",
};

export function TablaTransacciones({ transacciones, loading, onRefund }: TablaTransaccionesProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[60vh]">
    <table className="w-full text-left border-collapse">
      <thead className="sticky top-0 z-10 bg-surface-container-lowest">
        <tr className="bg-surface-container-lowest border-b border-slate-100">
          {["FECHA", "ENTIDAD", "CATEGORÍA", "CANTIDAD", "ESTADO", "FUENTE", ...(onRefund ? ["ACCIONES"] : [])].map((h) => (
            <th key={h} className="px-md py-4 font-label-caps text-on-surface-variant text-xs">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {transacciones.length === 0 && (
          <tr>
            <td colSpan={6} className="px-md py-8 text-center text-outline text-sm">
              No hay transacciones registradas.
            </td>
          </tr>
        )}
        {transacciones.map((t) => (
          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
            <td className="px-md py-4 text-sm text-slate-500">
              {new Date(t.fecha).toLocaleDateString("es-MX")}
            </td>
            <td className="px-md py-4 font-semibold text-on-surface text-sm">
              {t.corredor?.nombre ?? t.descripcion}
            </td>
            <td className="px-md py-4 text-sm text-slate-500 capitalize">{t.categoria}</td>
            <td className={`px-md py-4 text-right font-data-mono ${
              t.tipo === "ingreso" ? "text-secondary" : "text-tertiary"
            }`}>
              {t.tipo === "ingreso" ? "+" : "-"}${Number(t.monto).toFixed(2)}
            </td>
            <td className="px-md py-4 text-center">
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${ESTADO_BADGE[t.estado]}`}>
                {t.estado}
              </span>
            </td>
            <td className="px-md py-4">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${FUENTE_DOT[t.metodo] ?? "bg-slate-400"}`} />
                <span className="text-[11px] font-medium text-slate-400 capitalize">{t.metodo}</span>
              </div>
            </td>
            {onRefund && (
              <td className="px-md py-4">
                {t.estado === "pagado" && (
                  <button
                    onClick={async () => {
                      if (confirm(`¿Marcar como reembolsado el pago de $${Number(t.monto).toFixed(2)}?`)) {
                        await onRefund(t.id);
                      }
                    }}
                    className="text-xs text-outline hover:text-error flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">undo</span>
                    Reembolsar
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
