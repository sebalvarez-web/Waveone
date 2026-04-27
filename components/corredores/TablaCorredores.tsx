import Link from "next/link";
import type { Corredor } from "@/types/database";

interface TablaCorredoresProps {
  corredores: Corredor[];
  loading: boolean;
  onEdit: (corredor: Corredor) => void;
  onDelete: (id: string) => void;
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

export function TablaCorredores({ corredores, loading, onEdit, onDelete }: TablaCorredoresProps) {
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
              {["NOMBRE", "INGRESO", "UNIFORME", "ESTADO", "PLAN", "ENTRENADOR", "PRÓXIMA CARRERA", ""].map((h) => (
                <th key={h} className="px-5 py-3 text-[10px] font-bold tracking-wider text-on-surface-variant whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {corredores.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center">
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
                  <td className="px-5 py-3 text-sm text-on-surface-variant">{c.entrenador?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-sm text-on-surface-variant max-w-[160px] truncate">
                    {c.proxima_carrera ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(c)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                        aria-label={`Editar ${c.nombre}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${c.nombre}?`)) onDelete(c.id);
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                        aria-label={`Eliminar ${c.nombre}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
