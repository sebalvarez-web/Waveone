import { useState, useEffect } from "react";
import Head from "next/head";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Layout } from "@/components/layout/Layout";
import { TablaCorredores } from "@/components/corredores/TablaCorredores";
import { FormCorredor } from "@/components/corredores/FormCorredor";
import { useCorredores } from "@/hooks/useCorredores";
import { usePlanes } from "@/hooks/usePlanes";
import { toast } from "@/components/ui/Toast";
import type { Corredor, CorredorEstado } from "@/types/database";

export default function CorredoresPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCorredor, setEditingCorredor] = useState<Corredor | undefined>();
  const supabase = useSupabaseClient();
  const [filtroEstado, setFiltroEstado] = useState<CorredorEstado | "">("");
  const [filtroEntrenador, setFiltroEntrenador] = useState("");
  const [filtroPlan, setFiltroPlan] = useState("");
  const [entrenadores, setEntrenadores] = useState<{ id: string; nombre: string }[]>([]);
  const { corredores, loading, refetch, deleteCorredor } = useCorredores({
    search,
    estado: filtroEstado,
    entrenadorId: filtroEntrenador,
    planId: filtroPlan,
  });
  const { planes } = usePlanes();

  useEffect(() => {
    supabase
      .from("users")
      .select("id, nombre")
      .eq("rol", "entrenador")
      .then(({ data }) => setEntrenadores(data ?? []));
  }, [supabase]);

  const handleDelete = async (id: string) => {
    const err = await deleteCorredor(id);
    if (err) toast.error("Error al eliminar el corredor");
    else toast.success("Corredor eliminado");
  };

  const handleEdit = (corredor: Corredor) => {
    setEditingCorredor(corredor);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCorredor(undefined);
  };

  const activos = corredores.filter((c) => c.estado === "activo").length;
  const uniformesPendientes = corredores.filter((c) => !c.uniforme_entregado).length;
  const hasFilters = filtroEstado || filtroEntrenador || filtroPlan;

  const stats = [
    { label: "TOTAL", value: corredores.length, icon: "groups", tone: "neutral" as const },
    { label: "ACTIVOS", value: activos, icon: "directions_run", tone: "success" as const },
    { label: "UNIFORMES PENDIENTES", value: uniformesPendientes, icon: "checkroom", tone: "warning" as const },
    { label: "INACTIVOS", value: corredores.filter((c) => c.estado === "inactivo").length, icon: "person_off", tone: "neutral" as const },
  ];

  return (
    <>
      <Head><title>Wave One — Corredores</title></Head>
      <Layout onSearch={setSearch}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <p className="text-label-caps text-on-surface-variant mb-2">EQUIPO</p>
              <h2 className="text-headline-lg text-on-background font-headline">Corredores</h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Gestiona {corredores.length} miembro{corredores.length === 1 ? "" : "s"} y su logística de entrenamiento.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-3.5 py-2.5 bg-white border border-outline-variant rounded-lg flex items-center gap-2 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors">
                <span className="material-symbols-outlined text-[18px]">file_download</span>
                Exportar
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="px-3.5 py-2.5 bg-primary text-white rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-primary-fixed transition-colors shadow-soft"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Añadir corredor
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-outline-variant/60 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 shadow-soft">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">filter_alt</span>
            <FilterSelect
              value={filtroEstado}
              onChange={(v) => setFiltroEstado(v as CorredorEstado | "")}
              options={[
                { value: "", label: "Todos los estados" },
                { value: "activo", label: "Activo" },
                { value: "pausado", label: "Pausado" },
                { value: "inactivo", label: "Inactivo" },
              ]}
            />
            <FilterSelect
              value={filtroEntrenador}
              onChange={setFiltroEntrenador}
              options={[
                { value: "", label: "Todos los entrenadores" },
                ...entrenadores.map((e) => ({ value: e.id, label: e.nombre })),
              ]}
            />
            <FilterSelect
              value={filtroPlan}
              onChange={setFiltroPlan}
              options={[
                { value: "", label: "Todos los planes" },
                ...planes.map((p) => ({ value: p.id, label: p.nombre })),
              ]}
            />
            {hasFilters && (
              <button
                onClick={() => { setFiltroEstado(""); setFiltroEntrenador(""); setFiltroPlan(""); }}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-error transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Limpiar filtros
              </button>
            )}
          </div>

          <TablaCorredores
            corredores={corredores}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        {showForm && (
          <FormCorredor
            corredor={editingCorredor}
            planes={planes}
            onClose={handleCloseForm}
            onSuccess={refetch}
          />
        )}
      </Layout>
    </>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  tone: "neutral" | "success" | "warning";
}

function StatCard({ label, value, icon, tone }: StatCardProps) {
  const tones = {
    neutral: "text-on-surface bg-surface-container-low",
    success: "text-secondary bg-secondary-container",
    warning: "text-tertiary bg-tertiary-container",
  };
  return (
    <div className="bg-white border border-outline-variant/60 rounded-xl p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-headline font-bold text-on-surface mt-2 tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ value, onChange, options }: FilterSelectProps) {
  const isActive = value !== "";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-accent/15 transition-all cursor-pointer ${
        isActive
          ? "bg-accent-soft border-accent/30 text-on-background"
          : "bg-white border-outline-variant text-on-surface-variant hover:border-outline"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
