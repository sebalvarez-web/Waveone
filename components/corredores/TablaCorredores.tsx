import Link from "next/link";
import type { Corredor } from "@/types/database";

interface TablaCorredoresProps {
  corredores: Corredor[];
  loading: boolean;
  onEdit: (corredor: Corredor) => void;
  onDelete: (id: string) => void;
}

const ESTADO_BADGE: Record<string, string> = {
  activo: "bg-secondary/10 text-secondary",
  pausado: "bg-slate-100 text-slate-500",
  inactivo: "bg-tertiary/10 text-tertiary",
};

export function TablaCorredores({ corredores, loading, onEdit, onDelete }: TablaCorredoresProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Nombre", "Fecha Ingreso", "Uniforme", "Estado", "Plan", "Entrenador", "Próxima Carrera", ""].map(
                (h) => (
                  <th key={h} className="px-6 py-4 font-label-caps text-slate-500 uppercase tracking-wider text-xs">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {corredores.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-outline text-sm">
                  No hay corredores registrados.
                </td>
              </tr>
            )}
            {corredores.map((c) => {
              const initials = c.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
              return (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/corredores/${c.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-semibold text-xs">
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-on-surface text-sm">{c.nombre}</p>
                        <p className="text-xs text-slate-400">{c.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm font-data-mono">
                    {new Date(c.fecha_ingreso).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        c.uniforme_entregado
                          ? "bg-secondary/10 text-secondary"
                          : "bg-tertiary/10 text-tertiary"
                      }`}
                    >
                      {c.uniforme_entregado ? "Entregado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${ESTADO_BADGE[c.estado]}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {c.plan?.nombre ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {c.entrenador?.nombre ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {c.proxima_carrera ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(c)}
                        className="text-slate-400 hover:text-primary transition-colors p-1"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${c.nombre}?`)) onDelete(c.id);
                        }}
                        className="text-slate-400 hover:text-error transition-colors p-1"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
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
