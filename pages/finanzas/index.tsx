import Head from "next/head";
import { Layout } from "@/components/layout/Layout";
import { FormPagoManual } from "@/components/finanzas/FormPagoManual";
import { FormGasto } from "@/components/finanzas/FormGasto";
import { TablaTransacciones } from "@/components/finanzas/TablaTransacciones";
import { useTransacciones } from "@/hooks/useTransacciones";
import { useCorredores } from "@/hooks/useCorredores";
import { PagosSinAsignar } from "@/components/pagos/PagosSinAsignar";

export default function FinanzasPage() {
  const { transacciones, loading, refetch } = useTransacciones({ limit: 100 });
  const { corredores } = useCorredores();

  const ingresos = transacciones.filter((t) => t.tipo === "ingreso");
  const gastos = transacciones.filter((t) => t.tipo === "gasto");
  const saldoLiquido = ingresos.reduce((s, t) => s + Number(t.monto), 0) -
    gastos.reduce((s, t) => s + Number(t.monto), 0);
  const gastosPendientes = gastos.filter((t) => t.estado === "pendiente");
  const totalGastosPendientes = gastosPendientes.reduce((s, t) => s + Number(t.monto), 0);

  return (
    <>
      <Head><title>RunTeam Pro — Finanzas</title></Head>
      <Layout>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-headline-lg text-on-background font-headline">Gestión Financiera</h2>
            <p className="text-body-lg text-on-surface-variant">
              Seguimiento del rendimiento de ingresos y costes operativos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter mb-lg">
          <div className="col-span-12 md:col-span-4 bg-white p-md border border-slate-200 rounded-xl">
            <p className="font-label-caps text-on-surface-variant mb-2">SALDO LÍQUIDO ACTUAL</p>
            <span className="text-headline-lg text-primary font-headline">
              ${saldoLiquido.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="col-span-12 md:col-span-4 bg-white p-md border border-slate-200 rounded-xl">
            <p className="font-label-caps text-on-surface-variant mb-2">GASTOS PENDIENTES</p>
            <span className="text-headline-lg text-tertiary font-headline">
              ${totalGastosPendientes.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[11px] text-slate-400 mt-1 uppercase">
              {gastosPendientes.length} activos
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 bg-white p-md border border-slate-200 rounded-xl">
            <p className="font-label-caps text-on-surface-variant mb-2">TOTAL INGRESOS</p>
            <span className="text-headline-lg text-secondary font-headline">
              ${ingresos.reduce((s, t) => s + Number(t.monto), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-7 space-y-gutter">
            <section className="bg-white border border-slate-200 rounded-xl">
              <div className="p-md border-b border-slate-100">
                <h3 className="font-headline-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">account_balance</span>
                  Entrada Bancaria Manual
                </h3>
              </div>
              <div className="p-md">
                <FormPagoManual corredores={corredores} onSuccess={refetch} />
              </div>
            </section>
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-gutter">
            <section className="bg-white border border-slate-200 rounded-xl">
              <div className="p-md border-b border-slate-100">
                <h3 className="font-headline-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary">receipt_long</span>
                  Añadir Gasto
                </h3>
              </div>
              <div className="p-md">
                <FormGasto onSuccess={refetch} />
              </div>
            </section>
          </div>
        </div>

        <section className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-headline-sm text-on-surface">Pagos Sin Asignar</h3>
          </div>
          <PagosSinAsignar corredores={corredores} onReconciliado={refetch} />
        </section>

        <section className="mt-lg bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-md border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-headline-sm">Libro Maestro de Transacciones</h3>
          </div>
          <TablaTransacciones transacciones={transacciones} loading={loading} />
          <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
            <p className="text-sm text-outline">
              Mostrando {transacciones.length} transacciones
            </p>
          </div>
        </section>
      </Layout>
    </>
  );
}
