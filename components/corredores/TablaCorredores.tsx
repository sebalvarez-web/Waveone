import Link from "next/link";
import type { Corredor } from "@/types/database";

export interface Balance { devengados: number; pagados: number; saldo: number }

interface TablaCorredoresProps {
  corredores: Corredor[];
  balances?: Record<string, Balance>;
  loading: boolean;
  onEdit?: (corredor: Corredor) => void;
  onDelete?: (id: string) => void;
  hideEntrenador?: boolean;
  coaches?: { id: string; nombre: string }[];
  onChangeCoach?: (corredorId: string, coachId: string | null) => void | Promise<void>;
}

function fmtSaldo(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const ESTADO_CFG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  activo:   { bg: "bg-secondary-container", text: "text-on-secondary-container", dot: "bg-secondary", label: "Activo" },
  pausado:  { bg: "bg-surface-container",   text: "text-on-surface-variant",     dot: "bg-outline",   label: "Pausado" },
  inactivo: { bg: "bg-error-container",     text: "text-on-error-container",     dot: "bg-error",     label: "Inactivo" },
};

function BadgeEstado({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? { bg: "bg-surface-container", text: "text-on-surface-variant", dot: "bg-outline", label: estado };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function TablaCorredores({ corredores, balances, loading, onEdit, onDelete, hideEntrenador = false, coaches, onChangeCoach }: TablaCorredoresProps) {
  const showActions = Boolean(onEdit || onDelete);
  const headers = ["NOMBRE", "INGRESO", "UNIFORME", "ESTADO", "PLAN", ...(hideEntrenador ? [] : ["ENTRENADOR"]), "MESES DEV.", "MESES PAG.", "SALDO", "PRÓXIMA CARRERA", ...(showActions ? [""] : [])];
  const colSpan = headers.length;
  if (loading) {
    return (
      <div className="bg-white border border-outline-variant/60 rounded-xl p-5 space-y-2 shadow-soft">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-surface-container-low rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-outline-variant/60 overflow-hidden shadow-soft">
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="bg-surface-container-low border-b border-outline-variant/40">
              {headers.map((h, i) => (
                <th key={`${h}-${i}`} className={`px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant whitespace-nowrap ${h === "SALDO" || h.startsWith("MESES") ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {corredores.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-3xl text-outline">person_search</span>
                    <p className="text-sm">No hay corredores que coincidan.</p>
                  </div>
                </td>
              </tr>
            )}
            {corredores.map((c) => {
              const initials = c.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
              return (
                <tr key={c.id} className="group hover:bg-surface-container-low/40 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/corredores/${c.id}`} className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-[#FF8A6B] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface text-sm group-hover:text-accent transition-colors truncate">
                          {c.nombre}
                        </p>
                        <p className="text-xs text-on-surface-variant truncate">{c.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-on-surface-variant text-sm font-mono whitespace-nowrap">
                    {new Date(c.fecha_ingreso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-5 py-3">
                    {c.uniforme_entregado ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Entregado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-tertiary">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3"><BadgeEstado estado={c.estado} /></td>
                  <td className="px-5 py-3 text-sm text-on-surface-variant">{c.plan?.nombre ?? "—"}</td>
                  {!hideEntrenador && (
                    <td className="px-5 py-3 text-sm text-on-surface-variant">
                      {coaches && onChangeCoach ? (
                        <select
                          value={c.entrenador?.id ?? ""}
                          onChange={(e) => onChangeCoach(c.id, e.target.value || null)}
                          onClick={(e) => e.stopPropagation()}
                          className="border border-outline-variant/60 rounded-md px-2 py-1 text-xs bg-white hover:border-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 cursor-pointer max-w-[160px]"
                          aria-label={`Cambiar entrenador de ${c.nombre}`}
                        >
                          <option value="">— Sin asignar —</option>
                          {coaches.map((co) => (
                            <option key={co.id} value={co.id}>{co.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        c.entrenador?.nombre ?? "—"
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3 text-sm font-mono text-on-surface text-right tabular-nums">
                    {balances?.[c.id]?.devengados ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-on-surface text-right tabular-nums">
                    {balances?.[c.id]?.pagados ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-right tabular-nums whitespace-nowrap">
                    {balances?.[c.id] ? (() => {
                      const s = balances[c.id].saldo;
                      if (s > 0) return <span className="text-secondary font-semibold">+${fmtSaldo(s)}</span>;
                      if (s < 0) return <span className="text-error font-semibold">-${fmtSaldo(Math.abs(s))}</span>;
                      return <span className="text-on-surface-variant font-semibold">$0</span>;
                    })() : "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-on-surface-variant max-w-[160px] truncate">
                    {c.proxima_carrera ?? "—"}
                  </td>
                  {showActions && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(c)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                            aria-label={`Editar ${c.nombre}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar a ${c.nombre}?`)) onDelete(c.id);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                            aria-label={`Eliminar ${c.nombre}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
