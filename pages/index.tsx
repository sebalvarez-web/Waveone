import Head from "next/head";
import { Layout } from "@/components/layout/Layout";

export default function DashboardPage() {
  return (
    <>
      <Head><title>RunTeam Pro — Panel</title></Head>
      <Layout>
        <div className="mb-8">
          <h2 className="text-headline-lg text-primary font-headline">
            Resumen del Panel
          </h2>
          <p className="text-body-lg text-outline">
            Métricas de rendimiento y salud financiera en tiempo real.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
          <p className="text-body-md">Dashboard con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
