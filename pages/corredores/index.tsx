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

  return (
    <>
      <Head><title>Wave One — Corredores</title></Head>
      <Layout onSearch={setSearch}>
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-headline-lg text-on-surface font-headline">
                Base de Datos de Corredores
              </h2>
              <p className="text-body-lg text-outline mt-1">
                Gestiona {corredores.length} miembros activos y su logística de entrenamiento.
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 border border-slate-200 rounded-lg flex items-center gap-2 bg-white text-slate-600 hover:bg-slate-50 text-sm">
                <span className="material-symbols-outlined text-[20px]">file_download</span>
                Exportar
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg flex items-center gap-2 text-sm font-semibold hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                Añadir Corredor
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as CorredorEstado | "")}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
            >
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="inactivo">Inactivo</option>
            </select>

            <select
              value={filtroEntrenador}
              onChange={(e) => setFiltroEntrenador(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
            >
              <option value="">Todos los entrenadores</option>
              {entrenadores.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>

            <select
              value={filtroPlan}
              onChange={(e) => setFiltroPlan(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
            >
              <option value="">Todos los planes</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>

            {(filtroEstado || filtroEntrenador || filtroPlan) && (
              <button
                onClick={() => { setFiltroEstado(""); setFiltroEntrenador(""); setFiltroPlan(""); }}
                className="text-sm text-outline hover:text-error flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
            {[
              { label: "Total Corredores", value: corredores.length, color: "text-on-surface" },
              { label: "Activos", value: activos, color: "text-secondary" },
              { label: "Uniformes Pendientes", value: uniformesPendientes, color: "text-tertiary" },
              { label: "Inactivos", value: corredores.filter((c) => c.estado === "inactivo").length, color: "text-slate-500" },
            ].map((s) => (
              <div key={s.label} className="bg-white p-6 rounded-xl border border-slate-200">
                <p className="text-label-caps text-slate-400 uppercase mb-2">{s.label}</p>
                <span className={`text-headline-md font-headline ${s.color}`}>{s.value}</span>
              </div>
            ))}
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
