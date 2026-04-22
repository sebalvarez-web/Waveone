import Head from "next/head";
import { Layout } from "@/components/layout/Layout";

export default function CorredoresPage() {
  return (
    <>
      <Head><title>RunTeam Pro — Corredores</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-on-surface font-headline">
            Base de Datos de Corredores
          </h2>
          <p className="text-body-lg text-outline">
            Gestiona los miembros activos y su logística de entrenamiento.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">directions_run</span>
          <p className="text-body-md">Tabla de corredores con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
