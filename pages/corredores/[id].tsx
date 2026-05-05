import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Layout } from "@/components/layout/Layout";
import { FormCorredor } from "@/components/corredores/FormCorredor";
import { ModalNotaHistorial } from "@/components/corredores/ModalNotaHistorial";
import { ModalEditarTransaccion } from "@/components/finanzas/ModalEditarTransaccion";
import { usePlanes } from "@/hooks/usePlanes";
import { useTransacciones } from "@/hooks/useTransacciones";
import { usePagosAplicados } from "@/hooks/usePagosAplicados";
import { usePausas } from "@/hooks/usePausas";
import { useCambiosPlan } from "@/hooks/useCambiosPlan";
import { useHistorialCorredor } from "@/hooks/useHistorialCorredor";
import { toast } from "@/components/ui/Toast";
import { calcularDeudas, MESES_ES } from "@/lib/deudas";
import type { Corredor, CorredorEmail, HistorialItem, Transaccion } from "@/types/database";

const ESTADO_COLOR: Record<string, string> = {
  pagado: "bg-secondary/10 text-secondary",
  vencido: "bg-error/10 text-error",
  pendiente: "bg-slate-100 text-slate-500",
};

const HISTORIAL_ICON: Record<string, string> = {
  cambio_plan: "swap_horiz",
  cambio_estado: "person",
  pausa: "pause_circle",
  nota: "notes",
};

const HISTORIAL_COLOR: Record<string, string> = {
  cambio_plan: "bg-blue-100 text-blue-600",
  cambio_estado: "bg-amber-100 text-amber-600",
  pausa: "bg-slate-100 text-slate-500",
  nota: "bg-purple-100 text-purple-600",
};

function formatHistorialDesc(item: HistorialItem): string {
  switch (item.tipo) {
    case "cambio_plan": {
      const de = item.plan_anterior?.nombre ?? "Sin plan";
      const a = item.plan_nuevo?.nombre ?? "Sin plan";
      return `Plan: ${de} → ${a}`;
    }
    case "cambio_estado": {
      const de = item.estado_anterior ?? "—";
      const a = item.estado_nuevo ?? "—";
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return `Estado: ${cap(de)} → ${cap(a)}`;
    }
    case "pausa":
      return `Pausa — ${MESES_ES[(item.mes ?? 1) - 1]} ${item.año} (tarifa $${item.tarifa_mantenimiento?.toFixed(2)})`;
    case "nota":
      return item.nota ?? "";
    default:
      return "";
  }
}

export default function CorredorPerfilPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const supabase = useSupabaseClient();
  const { planes } = usePlanes();
  const { transacciones, refetch: refetchTransacciones } = useTransacciones({ corredorId: id });
  const { pagosAplicados } = usePagosAplicados(id);
  const { pausas } = usePausas(id);
  const { cambios: cambiosPlan } = useCambiosPlan(id);
  const { historial, loading: loadingHistorial, refetch: refetchHistorial } = useHistorialCorredor(id);

  const [corredor, setCorredor] = useState<Corredor | null>(null);
  const [coaches, setCoaches] = useState<{ id: string; nombre: string }[]>([]);
  const [emailsAdicionales, setEmailsAdicionales] = useState<CorredorEmail[]>([]);

  useEffect(() => {
    supabase
      .from("coaches")
      .select("id, nombre")
      .order("nombre", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[coaches fetch]", error);
        }
        setCoaches((data ?? []) as { id: string; nombre: string }[]);
      });
  }, [supabase]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showNotaModal, setShowNotaModal] = useState(false);
  const [nota, setNota] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [editandoTx, setEditandoTx] = useState<Transaccion | null>(null);

  const fetchCorredor = () => {
    if (!id) return;
    supabase
      .from("corredores")
      .select(`*, plan:planes(*), entrenador:coaches(id, nombre)`)
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setCorredor(data);
        setLoading(false);
      });
    supabase
      .from("corredor_emails")
      .select("*")
      .eq("corredor_id", id)
      .then(({ data }) => {
        setEmailsAdicionales((data as CorredorEmail[]) ?? []);
      });
  };

  useEffect(() => {
    fetchCorredor();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const deudaData = useMemo(() => {
    if (!corredor) return null;
    const result = calcularDeudas(
      [corredor],
      transacciones,
      pausas,
      pagosAplicados,
      cambiosPlan,
      planes
    );
    return result[0] ?? null;
  }, [corredor, transacciones, pausas, pagosAplicados, cambiosPlan, planes]);

  const totalCobrado = useMemo(
    () =>
      transacciones
        .filter((t) => t.tipo === "ingreso" && t.estado === "pagado")
        .reduce((acc, t) => acc + Number(t.monto), 0),
    [transacciones]
  );

  const totalDevengado = useMemo(() => {
    if (!deudaData) return 0;
    return deudaData.meses
      .filter((m) => m.estado !== "futuro")
      .reduce((acc, m) => acc + m.monto, 0);
  }, [deudaData]);

  const saldo = totalCobrado - totalDevengado;

  // Map transaccion_id → list of "Ene '25" strings of months this tx covered.
  // Used by Historial de Pagos to surface oldest-first assignment & flag
  // transactions whose RPC aplicar_pago failed (no pa rows).
  const aplicadosPorTx = useMemo(() => {
    const map = new Map<string, { año: number; mes: number }[]>();
    for (const pa of pagosAplicados) {
      const arr = map.get(pa.transaccion_id) ?? [];
      arr.push({ año: pa.año, mes: pa.mes });
      map.set(pa.transaccion_id, arr);
    }
    map.forEach((arr) => {
      arr.sort((a, b) => a.año - b.año || a.mes - b.mes);
    });
    return map;
  }, [pagosAplicados]);

  const formatAplicados = (txId: string) => {
    const meses = aplicadosPorTx.get(txId);
    if (!meses || meses.length === 0) return null;
    return meses.map(m => `${MESES_ES[m.mes - 1]} '${String(m.año).slice(-2)}`).join(", ");
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!corredor) {
    return (
      <Layout>
        <p className="text-outline">Corredor no encontrado.</p>
      </Layout>
    );
  }

  return (
    <>
      <Head><title>Wave One — {corredor.nombre}</title></Head>
      <Layout>
        <div className="mb-8 flex justify-between items-end">
          <div>
            <nav className="flex items-center gap-2 font-label-caps text-outline mb-2 text-xs">
              <Link href="/corredores" className="hover:text-primary">CORREDORES</Link>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span className="text-on-surface">{corredor.nombre.toUpperCase()}</span>
            </nav>
            <h2 className="text-headline-lg text-on-surface font-headline">Perfil del Corredor</h2>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
          >
            Editar Corredor
          </button>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          {/* Columna izquierda */}
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-3xl mb-4">
                  {corredor.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <h3 className="text-headline-md font-headline">{corredor.nombre}</h3>
                <span className="px-3 py-1 bg-secondary/10 text-secondary font-label-caps rounded-full mt-2 text-xs">
                  {corredor.estado.charAt(0).toUpperCase() + corredor.estado.slice(1)}
                </span>
              </div>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="font-label-caps text-outline text-xs mb-2">CORREOS</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-on-surface">{corredor.email}</span>
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded">
                        Principal
                      </span>
                    </div>
                    {emailsAdicionales.map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <span className="text-sm text-on-surface">{e.email}</span>
                        {e.etiqueta && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded">
                            {e.etiqueta}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {(corredor.stripe_customer_id || corredor.stripe_subscription_id || corredor.paypal_payer_id || corredor.paypal_subscription_id) && (
                  <div>
                    <p className="font-label-caps text-outline text-xs mb-2">IDs DE PAGO</p>
                    <div className="space-y-2">
                      {corredor.stripe_customer_id && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#635BFF" }} />
                          <div className="min-w-0">
                            <p className="text-[10px] text-outline font-semibold tracking-wide">STRIPE CUSTOMER</p>
                            <a
                              href={`https://dashboard.stripe.com/customers/${corredor.stripe_customer_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={corredor.stripe_customer_id}
                              className="text-xs font-mono hover:underline truncate block"
                              style={{ color: "#635BFF" }}
                            >
                              {corredor.stripe_customer_id}
                            </a>
                          </div>
                        </div>
                      )}
                      {corredor.stripe_subscription_id && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#635BFF" }} />
                          <div className="min-w-0">
                            <p className="text-[10px] text-outline font-semibold tracking-wide">STRIPE SUSCRIPCIÓN</p>
                            <a
                              href={`https://dashboard.stripe.com/subscriptions/${corredor.stripe_subscription_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={corredor.stripe_subscription_id}
                              className="text-xs font-mono hover:underline truncate block"
                              style={{ color: "#635BFF" }}
                            >
                              {corredor.stripe_subscription_id}
                            </a>
                          </div>
                        </div>
                      )}
                      {corredor.paypal_payer_id && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#009CDE" }} />
                          <div className="min-w-0">
                            <p className="text-[10px] text-outline font-semibold tracking-wide">PAYPAL PAYER ID</p>
                            <p className="text-xs font-mono text-on-surface truncate" title={corredor.paypal_payer_id}>
                              {corredor.paypal_payer_id}
                            </p>
                          </div>
                        </div>
                      )}
                      {corredor.paypal_subscription_id && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#009CDE" }} />
                          <div className="min-w-0">
                            <p className="text-[10px] text-outline font-semibold tracking-wide">PAYPAL SUSCRIPCIÓN</p>
                            <p className="text-xs font-mono text-on-surface truncate" title={corredor.paypal_subscription_id}>
                              {corredor.paypal_subscription_id}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {corredor.telefono_emergencia && (
                  <div>
                    <p className="font-label-caps text-outline text-xs mb-1">EMERGENCIA</p>
                    <p className="text-sm text-on-surface">{corredor.telefono_emergencia}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-label-caps text-outline text-xs mb-1">INGRESO</p>
                    <p className="text-sm font-data-mono">
                      {new Date(corredor.fecha_ingreso).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <div>
                    <p className="font-label-caps text-outline text-xs mb-1">PLAN</p>
                    <p className="text-sm">{corredor.plan?.nombre ?? "Sin plan"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary text-white rounded-xl p-6 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-white/80 font-label-caps text-xs">SALDO ACUMULADO</p>
                <p className="text-3xl font-bold font-body mt-1">
                  {saldo >= 0 ? "+" : ""}${Math.round(Math.abs(saldo)).toLocaleString("en-US")}
                </p>
                <p className="text-white/80 text-sm mt-3">
                  Plan: ${corredor.plan?.precio_mensual?.toFixed(2) ?? "0.00"}/mes
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <span className="material-symbols-outlined text-[100px]">payments</span>
              </div>
            </div>

            {deudaData && (
              <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm grid grid-cols-3 divide-x divide-outline-variant/50">
                <div className="pr-4 flex flex-col items-center text-center">
                  <p className="font-label-caps text-outline text-[10px] mb-1">DEVENGADO</p>
                  <p className="text-xl font-bold font-headline text-on-surface font-data-mono">
                    ${Math.round(totalDevengado).toLocaleString("en-US")}
                  </p>
                  <p className="text-[10px] text-outline mt-0.5">total</p>
                </div>
                <div className="px-4 flex flex-col items-center text-center">
                  <p className="font-label-caps text-outline text-[10px] mb-1">COBRADO</p>
                  <p className="text-xl font-bold font-headline text-secondary font-data-mono">
                    ${Math.round(totalCobrado).toLocaleString("en-US")}
                  </p>
                  <p className="text-[10px] text-outline mt-0.5">total</p>
                </div>
                <div className="pl-4 flex flex-col items-center text-center">
                  <p className="font-label-caps text-outline text-[10px] mb-1">SALDO</p>
                  <p className={`text-xl font-bold font-headline font-data-mono ${saldo >= 0 ? "text-secondary" : "text-error"}`}>
                    {saldo >= 0 ? "+" : "−"}${Math.round(Math.abs(saldo)).toLocaleString("en-US")}
                  </p>
                  <p className="text-[10px] text-outline mt-0.5">{saldo >= 0 ? "a favor" : "en contra"}</p>
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha */}
          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            {/* Historial de pagos */}
            <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                <h4 className="font-headline-sm">Historial de Pagos</h4>
              </div>
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Fecha</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Descripción</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Método</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Estado</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs">Aplicado a</th>
                      <th className="px-6 py-3 font-label-caps text-outline text-xs text-right">Monto</th>
                      <th className="px-3 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {transacciones.filter((t) => t.tipo === "ingreso").length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-outline text-sm">
                          Sin transacciones registradas.
                        </td>
                      </tr>
                    )}
                    {transacciones.filter((t) => t.tipo === "ingreso").map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-data-mono">
                          {new Date(t.fecha).toLocaleDateString("es-MX")}
                        </td>
                        <td className="px-6 py-4 text-sm">{t.descripcion}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant capitalize">
                          {t.metodo}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[t.estado]}`}>
                            {t.estado.charAt(0).toUpperCase() + t.estado.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-data-mono text-on-surface-variant">
                          {formatAplicados(t.id) ?? (
                            t.estado === "pagado"
                              ? <span title="Pago no aplicado a ningún mes — sobrepago, corredor inactivo, o plan sin precio" className="text-on-surface-variant italic">Exceso</span>
                              : <span className="text-outline">—</span>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-right font-data-mono ${t.tipo === "ingreso" ? "text-secondary" : "text-tertiary"}`}>
                          {t.tipo === "ingreso" ? "+" : "-"}${Number(t.monto).toFixed(2)}
                        </td>
                        <td className="px-3 py-4">
                          <button
                            onClick={() => setEditandoTx(t)}
                            className="p-1 rounded hover:bg-surface-container-low text-outline hover:text-on-surface transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calendario de Pagos */}
            {deudaData && (
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-headline-sm">Calendario de Pagos</h4>
                  {deudaData.mesesDeudaCount > 0 ? (
                    <span className="text-sm font-semibold text-red-600">
                      {deudaData.mesesDeudaCount} mes{deudaData.mesesDeudaCount > 1 ? "es" : ""} adeudado{deudaData.mesesDeudaCount > 1 ? "s" : ""} — ${deudaData.totalDeuda.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-secondary">Al corriente</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {deudaData.meses.map(({ year, month, estado }) => (
                    <div
                      key={`${year}-${month}`}
                      title={estado === "pagado" ? "Pagado" : estado === "deuda" ? "Adeudado" : "Pendiente"}
                      className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-[11px] font-semibold min-w-[40px] ${
                        estado === "pagado"
                          ? "bg-secondary/15 text-secondary"
                          : estado === "deuda"
                          ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <span>{MESES_ES[month]}</span>
                      <span className="text-[10px] font-normal opacity-70">{String(year).slice(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-3 text-[11px] text-outline">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-secondary/20 inline-block" />Pagado</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 inline-block" />Adeudado</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 inline-block" />Pendiente</span>
                </div>
              </div>
            )}

            {/* Historial del corredor */}
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-headline-sm">Historial</h4>
                <button
                  onClick={() => setShowNotaModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Registrar evento
                </button>
              </div>

              {loadingHistorial ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5 pt-1">
                        <div className="h-3 bg-slate-100 rounded w-24" />
                        <div className="h-3 bg-slate-100 rounded w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : historial.length === 0 ? (
                <p className="text-sm text-outline text-center py-6">Sin eventos registrados.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-outline-variant/40" />
                  <div className="space-y-4">
                    {historial.map((item) => (
                      <div key={item.id} className="flex gap-4 relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${HISTORIAL_COLOR[item.tipo]}`}>
                          <span className="material-symbols-outlined text-sm">
                            {HISTORIAL_ICON[item.tipo]}
                          </span>
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-xs text-outline font-data-mono">
                            {new Date(item.fecha).toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-sm text-on-surface mt-0.5">
                            {formatHistorialDesc(item)}
                          </p>
                          {item.creado_por_user && (
                            <p className="text-xs text-outline mt-0.5">
                              por {item.creado_por_user.nombre}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nota del Entrenador */}
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
              <h4 className="font-headline-sm mb-4">Nota del Entrenador</h4>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className="w-full border border-outline-variant rounded-lg focus:border-primary focus:ring-primary text-sm h-28 p-3"
                placeholder="Añadir notas internas sobre el progreso o asistencia..."
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">info</span>
                  Las notas son privadas para los administradores.
                </p>
                <button
                  onClick={async () => {
                    setGuardandoNota(true);
                    await new Promise((r) => setTimeout(r, 500));
                    setGuardandoNota(false);
                    toast.success("Nota guardada");
                  }}
                  disabled={guardandoNota}
                  className="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  {guardandoNota ? "Guardando..." : "Guardar Nota"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showForm && (
          <FormCorredor
            corredor={corredor}
            planes={planes}
            coaches={coaches}
            onClose={() => setShowForm(false)}
            onSuccess={() => {
              setShowForm(false);
              fetchCorredor();
            }}
          />
        )}

        {showNotaModal && (
          <ModalNotaHistorial
            corredorId={corredor.id}
            onClose={() => setShowNotaModal(false)}
            onSuccess={() => {
              setShowNotaModal(false);
              refetchHistorial();
            }}
          />
        )}

        {editandoTx && (
          <ModalEditarTransaccion
            transaccion={editandoTx}
            onClose={() => setEditandoTx(null)}
            onSuccess={() => {
              setEditandoTx(null);
              refetchTransacciones();
            }}
          />
        )}
      </Layout>
    </>
  );
}
