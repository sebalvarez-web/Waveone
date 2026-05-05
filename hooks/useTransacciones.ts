import { useEffect, useState, useCallback, useRef } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Transaccion, TransaccionTipo } from "@/types/database";

interface UseTransaccionesOptions {
  limit?: number;
  corredorId?: string;
  soloIngresoPagado?: boolean;
  fetchAll?: boolean;
  tipo?: TransaccionTipo;
  withCorredor?: boolean;
  realtime?: boolean;
}

export function useTransacciones({
  limit = 50,
  corredorId,
  soloIngresoPagado = false,
  fetchAll = false,
  tipo,
  withCorredor = true,
  realtime = false,
}: UseTransaccionesOptions = {}) {
  const supabase = useSupabaseClient();
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const inflightRef = useRef(false);

  const fetchTransacciones = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);

    try {
      if (soloIngresoPagado) {
        const PAGE = 1000;
        const SELECT = "id,corredor_id,tipo,estado,fecha,monto,descripcion,metodo,created_at";
        const { count, error: countErr } = await supabase
          .from("transacciones")
          .select("id", { count: "exact", head: true })
          .eq("tipo", "ingreso")
          .eq("estado", "pagado");
        if (countErr) { setError(countErr); return; }
        const total = count ?? 0;
        if (total === 0) { setTransacciones([]); return; }
        const pages = Math.ceil(total / PAGE);
        const reqs = Array.from({ length: pages }, (_, i) =>
          supabase
            .from("transacciones")
            .select(SELECT)
            .eq("tipo", "ingreso")
            .eq("estado", "pagado")
            .order("fecha", { ascending: false })
            .order("id", { ascending: false })
            .range(i * PAGE, i * PAGE + PAGE - 1)
        );
        const results = await Promise.all(reqs);
        const all: Transaccion[] = [];
        for (const { data, error: err } of results) {
          if (err) { setError(err); return; }
          all.push(...((data ?? []) as unknown as Transaccion[]));
        }
        setTransacciones(all);
        return;
      }

      if (fetchAll) {
        const PAGE = 1000;
        const SELECT = withCorredor ? `*, corredor:corredores(id, nombre)` : `*`;
        let countQuery = supabase
          .from("transacciones")
          .select("id", { count: "exact", head: true });
        if (corredorId) countQuery = countQuery.eq("corredor_id", corredorId);
        if (tipo) countQuery = countQuery.eq("tipo", tipo);
        const { count, error: countErr } = await countQuery;
        if (countErr) { setError(countErr); return; }
        const total = count ?? 0;
        if (total === 0) { setTransacciones([]); return; }
        const pages = Math.ceil(total / PAGE);
        const reqs = Array.from({ length: pages }, (_, i) => {
          let q = supabase
            .from("transacciones")
            .select(SELECT)
            .order("fecha", { ascending: false })
            .order("id", { ascending: false })
            .range(i * PAGE, i * PAGE + PAGE - 1);
          if (corredorId) q = q.eq("corredor_id", corredorId);
          if (tipo) q = q.eq("tipo", tipo);
          return q;
        });
        const results = await Promise.all(reqs);
        const all: Transaccion[] = [];
        for (const { data, error: err } of results) {
          if (err) { setError(err); return; }
          all.push(...((data ?? []) as unknown as Transaccion[]));
        }
        setTransacciones(all);
        return;
      }

      let query = supabase
        .from("transacciones")
        .select(withCorredor ? `*, corredor:corredores(id, nombre)` : `*`)
        .order("fecha", { ascending: false })
        .limit(limit);

      if (corredorId) query = query.eq("corredor_id", corredorId);
      if (tipo) query = query.eq("tipo", tipo);

      const { data, error: err } = await query;
      if (err) {
        setError(err);
        setTransacciones([]);
      } else {
        setTransacciones((data ?? []) as unknown as Transaccion[]);
      }
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, [supabase, limit, corredorId, soloIngresoPagado, fetchAll, tipo, withCorredor]);

  useEffect(() => {
    fetchTransacciones();

    if (!realtime) return;

    // Throttled refetch: coalesce bursts of webhook inserts into one fetch.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        fetchTransacciones();
      }, 2000);
    };

    const channel = supabase
      .channel("transacciones-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transacciones" },
        schedule,
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, [fetchTransacciones, supabase, realtime]);

  const insertTransaccion = async (
    transaccion: Omit<Transaccion, "id" | "created_at">
  ) => {
    const { error: err } = await supabase
      .from("transacciones")
      .insert(transaccion);
    if (!err) fetchTransacciones();
    return err;
  };

  return { transacciones, loading, error, refetch: fetchTransacciones, insertTransaccion };
}
