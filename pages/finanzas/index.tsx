import Head from "next/head";
import { Layout } from "@/components/layout/Layout";

export default function FinanzasPage() {
  return (
    <>
      <Head><title>RunTeam Pro — Finanzas</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-on-background font-headline">
            Gestión Financiera
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Seguimiento de ingresos y costes operativos.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">payments</span>
          <p className="text-body-md">Gestión financiera con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
