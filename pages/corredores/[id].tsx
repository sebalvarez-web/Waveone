import Head from "next/head";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout/Layout";

export default function CorredorPerfilPage() {
  const { query } = useRouter();

  return (
    <>
      <Head><title>RunTeam Pro — Perfil del Corredor</title></Head>
      <Layout>
        <div className="mb-6">
          <nav className="flex items-center gap-2 text-label-caps text-outline mb-2 text-xs">
            <a href="/corredores" className="hover:text-primary">CORREDORES</a>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-on-surface">{query.id ?? "..."}</span>
          </nav>
          <h2 className="text-headline-lg text-on-surface font-headline">
            Perfil del Corredor
          </h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-outline">
          <span className="material-symbols-outlined text-4xl mb-2">person</span>
          <p className="text-body-md">Perfil con datos reales — disponible en Plan 2</p>
        </div>
      </Layout>
    </>
  );
}
