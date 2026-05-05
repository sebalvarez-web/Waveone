import Head from "next/head";
import { Layout } from "@/components/layout/Layout";
import { FormPagoManual } from "@/components/finanzas/FormPagoManual";
import { FormGasto } from "@/components/finanzas/FormGasto";
import { TablaTransacciones } from "@/components/finanzas/TablaTransacciones";
import { useTransacciones } from "@/hooks/useTransacciones";
import { useCorredores } from "@/hooks/useCorredores";
import { PagosSinAsignar } from "@/components/pagos/PagosSinAsignar";
import { GraficasFinanzas } from "@/components/finanzas/GraficasFinanzas";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import toast from "react-hot-toast";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FinanzasPage() {
  const { transacciones, loading, refetch } = useTransacciones({ fetchAll: true });
  const { corredores } = useCorredores();
  const supabase = useSupabaseClient();

  const handleRefund = async (id: string) => {
    const { error } = await supabase
      .from("transacciones")
      .update({ estado: "reembolsado" })
      .eq("id", id);
    if (error) toast.error("Error al registrar reembolso");
    else { toast.success("Reembolso registrado"); refetch(); }
  };

  const ingresos = transacciones.filter((t) => t.tipo === "ingreso");
  const gastos = transacciones.filter((t) => t.tipo === "gasto");
  // KPIs reflect cleared cash: pagado-only. Pendiente/vencido/reembolsado are
  // shown elsewhere (gastosPendientes card + ledger table) and must not inflate
  // saldo líquido.
  const ingresosPagados = ingresos.filter((t) => t.estado === "pagado");
  const gastosPagados = gastos.filter((t) => t.estado === "pagado");
  const totalIngresos = ingresosPagados.reduce((s, t) => s + Number(t.monto), 0);
  const totalGastos = gastosPagados.reduce((s, t) => s + Number(t.monto), 0);
  const saldoLiquido = totalIngresos - totalGastos;
  const gastosPendientes = gastos.filter((t) => t.estado === "pendiente");
  const totalGastosPendientes = gastosPendientes.reduce((s, t) => s + Number(t.monto), 0);

  return (
    <>
      <Head><title>Wave One — Finanzas</title></Head>
      <Layout>
        <div className="mb-6">
          <p className="text-label-caps text-on-surface-variant mb-2">FINANZAS</p>
          <h2 className="text-headline-lg text-on-background font-headline">Gestión financiera</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Rendimiento de ingresos y costes operativos en un solo lugar.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-primary text-white rounded-xl p-5 shadow-soft relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-accent/25 blur-3xl" />
            <p className="text-[10px] font-bold tracking-wider text-white/70 relative">SALDO LÍQUIDO</p>
            <p className="text-display-md font-headline mt-2 tabular-nums tracking-tight relative leading-none">
              ${fmt(saldoLiquido)}
            </p>
            <p className="text-[11px] text-white/60 mt-2 relative">
              Ingresos − Gastos
            </p>
          </div>
          <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">TOTAL INGRESOS</p>
              <span className="material-symbols-outlined text-secondary text-[18px]">trending_up</span>
            </div>
            <p className="text-3xl font-headline font-bold text-secondary mt-2 tabular-nums tracking-tight">
              ${fmt(totalIngresos)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">{ingresosPagados.length} entradas pagadas</p>
          </div>
          <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold tracking-wider text-on-surface-variant">GASTOS PENDIENTES</p>
              <span className="material-symbols-outlined text-tertiary text-[18px]">schedule</span>
            </div>
            <p className="text-3xl font-headline font-bold text-tertiary mt-2 tabular-nums tracking-tight">
              ${fmt(totalGastosPendientes)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">{gastosPendientes.length} por aprobar</p>
          </div>
        </div>

        <GraficasFinanzas transacciones={transacciones} />

        {/* Forms grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <FormCard icon="account_balance" iconBg="bg-info-container" iconText="text-info" title="Entrada bancaria manual">
            <FormPagoManual corredores={corredores} onSuccess={refetch} />
          </FormCard>
          <FormCard icon="receipt_long" iconBg="bg-tertiary-container" iconText="text-tertiary" title="Añadir gasto">
            <FormGasto onSuccess={refetch} />
          </FormCard>
        </div>

        {/* Pagos sin asignar */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-headline-sm font-headline text-on-surface">Pagos sin asignar</h3>
            <span className="material-symbols-outlined text-tertiary text-[18px]">warning</span>
          </div>
          <PagosSinAsignar corredores={corredores} onReconciliado={refetch} />
        </section>

        {/* Libro maestro */}
        <section className="bg-white border border-outline-variant/60 rounded-xl overflow-hidden shadow-soft">
          <div className="px-5 py-4 border-b border-outline-variant/40 flex justify-between items-center">
            <div>
              <h3 className="text-headline-sm font-headline text-on-surface">Libro maestro</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Todas las transacciones registradas</p>
            </div>
          </div>
          <TablaTransacciones transacciones={transacciones} loading={loading} onRefund={handleRefund} />
          <div className="px-5 py-3 bg-surface-container-low/40 border-t border-outline-variant/40 text-xs text-on-surface-variant">
            Mostrando <span className="font-semibold text-on-surface">{transacciones.length}</span> transacciones
          </div>
        </section>
      </Layout>
    </>
  );
}

function FormCard({
  icon, iconBg, iconText, title, children,
}: { icon: string; iconBg: string; iconText: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-outline-variant/60 rounded-xl shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <span className={`material-symbols-outlined text-[20px] ${iconText}`}>{icon}</span>
        </div>
        <h3 className="text-headline-sm font-headline text-on-surface">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
