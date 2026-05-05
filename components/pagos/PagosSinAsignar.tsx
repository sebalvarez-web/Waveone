import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/Toast";
import type { PagoSinAsignar, Corredor } from "@/types/database";

interface PagosSinAsignarProps {
  corredores: Pick<Corredor, "id" | "nombre">[];
  onReconciliado: () => void;
}

function extractInfo(pago: PagoSinAsignar): {
  id: string | null;
  email: string | null;
  nombre: string | null;
  concepto: string | null;
  linkUrl: string | null;
} {
  const p = pago.payload;

  if (pago.fuente === "stripe") {
    const invoiceId = (p.id as string | null) ?? null;
    const lines = p.lines as { data?: { description?: string }[] } | undefined;
    return {
      id: invoiceId,
      email: (p.customer_email as string | null) ?? null,
      nombre: (p.customer_name as string | null) ?? null,
      concepto: lines?.data?.[0]?.description ?? null,
      linkUrl: invoiceId ? `https://dashboard.stripe.com/invoices/${invoiceId}` : null,
    };
  }

  if (pago.fuente === "paypal") {
    // Payload stored by webhook: { sale_id, email, nombre, subscription_id, payer_id, raw }
    // Payload stored by sync:    { resource: { id, transaction_info, payer_info: { payer_name, email_address } } }
    type PayerName = { given_name?: string; surname?: string; alternate_full_name?: string };
    type SyncRes = { id?: string; payer_info?: { email_address?: string; payer_name?: PayerName }; transaction_info?: { paypal_reference_id?: string } };
    type RawRes = { resource?: { subscriber?: { name?: { given_name?: string; surname?: string }; email_address?: string } } };
    const syncResource = (p.resource as SyncRes | undefined) ?? null;
    const raw = (p.raw as RawRes | undefined) ?? null;

    const txId = (p.sale_id as string | null) ?? syncResource?.id ?? null;
    const email =
      (p.email as string | null) ??
      syncResource?.payer_info?.email_address ??
      raw?.resource?.subscriber?.email_address ??
      null;
    const rawName = raw?.resource?.subscriber?.name;
    const syncPayerName = syncResource?.payer_info?.payer_name;
    const nombre =
      (p.nombre as string | null) ??
      (syncPayerName?.alternate_full_name || null) ??
      (syncPayerName ? `${syncPayerName.given_name ?? ""} ${syncPayerName.surname ?? ""}`.trim() || null : null) ??
      (rawName ? `${rawName.given_name ?? ""} ${rawName.surname ?? ""}`.trim() || null : null) ??
      null;
    const subscriptionId =
      (p.subscription_id as string | null) ??
      syncResource?.transaction_info?.paypal_reference_id ??
      null;
    return {
      id: txId ?? subscriptionId,
      email,
      nombre,
      concepto: subscriptionId ? `Suscripción ${subscriptionId}` : null,
      linkUrl: txId ? `https://www.paypal.com/activity/payment/${txId}` : null,
    };
  }

  return { id: null, email: null, nombre: null, concepto: null, linkUrl: null };
}

const ACCENT = "#C8FF00";

function CorredorSearch({
  corredores,
  value,
  onChange,
}: {
  corredores: Pick<{ id: string; nombre: string }, "id" | "nombre">[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = corredores.find(c => c.id === value);
  const filtered = query.trim()
    ? corredores.filter(c => c.nombre.toLowerCase().includes(query.toLowerCase()))
    : corredores;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (id: string, nombre: string) => {
    onChange(id);
    setQuery(nombre);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onChange("");
    setOpen(true);
  };

  const handleFocus = () => {
    if (!selected) setQuery("");
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={selected && !open ? selected.nombre : query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Buscar corredor..."
          className="w-full border border-outline-variant rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"
        />
        {value && (
          <button
            onMouseDown={e => { e.preventDefault(); onChange(""); setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-outline-variant rounded-lg shadow-lg max-h-48 overflow-auto">
          {filtered.map(c => (
            <li
              key={c.id}
              onMouseDown={e => { e.preventDefault(); handleSelect(c.id, c.nombre); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[14px] text-outline">person</span>
              {c.nombre}
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-outline-variant rounded-lg shadow-lg px-3 py-2 text-sm text-outline">
          Sin resultados
        </div>
      )}
    </div>
  );
}

export function PagosSinAsignar({ corredores, onReconciliado }: PagosSinAsignarProps) {
  const [pagos, setPagos] = useState<PagoSinAsignar[]>([]);
  const [loading, setLoading] = useState(true);
  const [asignando, setAsignando] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});

  const loadPagos = async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/pagos/sin-asignar", signal ? { signal } : {});
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setPagos(Array.isArray(data) ? data : []);
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") {
        toast.error("No se pudieron cargar los pagos pendientes");
        setPagos([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadPagos(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReconciliar = async (pagoId: string) => {
    const corredorId = seleccion[pagoId];
    if (!corredorId) { toast.error("Selecciona un corredor primero"); return; }

    setAsignando(pagoId);
    try {
      const res = await fetch("/api/pagos/sin-asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pago_id: pagoId, corredor_id: corredorId }),
      });
      if (!res.ok) { toast.error("Error al reconciliar el pago"); return; }
      toast.success("Pago asignado correctamente");
      loadPagos();
      onReconciliado();
    } catch {
      toast.error("Error de conexión al reconciliar");
    } finally {
      setAsignando(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (pagos.length === 0) {
    return (
      <div className="bg-secondary/10 text-secondary rounded-xl p-6 text-center">
        <span className="material-symbols-outlined text-2xl mb-2">check_circle</span>
        <p className="text-sm font-semibold">No hay pagos pendientes de asignar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pagos.map((pago) => {
        const info = extractInfo(pago);
        const isStripe = pago.fuente === "stripe";

        return (
          <div
            key={pago.id}
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3"
          >
            {/* Top row: icon + detail + monto */}
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
                style={{ background: isStripe ? "#635BFF" : "#003087" }}
              >
                {isStripe ? "S" : "P"}
              </div>

              <div className="flex-1 min-w-0">
                {/* Nombre como título principal si está disponible */}
                {(info.nombre || info.email) && (
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {info.nombre ?? info.email}
                  </p>
                )}

                {/* Email secundario si ya mostramos el nombre */}
                {info.nombre && info.email && (
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">{info.email}</p>
                )}

                {/* Concepto */}
                {info.concepto && (
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate" title={info.concepto}>
                    {info.concepto}
                  </p>
                )}

                {/* ID con link */}
                {info.id && (
                  <p className="text-[11px] text-outline mt-1 font-mono flex items-center gap-1">
                    <span className="capitalize">{pago.fuente}</span>
                    <span>·</span>
                    {info.linkUrl ? (
                      <a
                        href={info.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                        style={{ color: isStripe ? "#635BFF" : "#009CDE" }}
                        title={info.id}
                      >
                        {info.id.slice(0, 20)}…
                      </a>
                    ) : (
                      <span title={info.id}>{info.id.slice(0, 20)}…</span>
                    )}
                    <span>·</span>
                    <span>{new Date(pago.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </p>
                )}

                {/* Fallback si no hay info extra */}
                {!info.concepto && !info.nombre && !info.email && (
                  <p className="text-xs text-on-surface-variant capitalize">
                    {pago.fuente} · {new Date(pago.fecha).toLocaleDateString("es-MX")}
                  </p>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <p className="font-mono font-bold text-on-surface text-base">
                  ${Number(pago.monto).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-outline mt-0.5">MXN</p>
              </div>
            </div>

            {/* Bottom row: selector + button */}
            <div className="flex items-center gap-2 pl-[52px]">
              <CorredorSearch
                corredores={corredores}
                value={seleccion[pago.id] ?? ""}
                onChange={(id) => setSeleccion((prev) => ({ ...prev, [pago.id]: id }))}
              />
              <button
                onClick={() => handleReconciliar(pago.id)}
                disabled={asignando === pago.id || !seleccion[pago.id]}
                className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 transition-all flex-shrink-0"
                style={{
                  background: seleccion[pago.id] ? ACCENT : "rgba(200,255,0,0.12)",
                  color: seleccion[pago.id] ? "#1a1a1a" : "#8A8578",
                  border: `1.5px solid ${ACCENT}50`,
                }}
              >
                {asignando === pago.id ? "Asignando..." : "Asignar"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
