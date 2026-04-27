import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Transaccion } from "@/types/database";

interface UseTransaccionesOptions {
  limit?: number;
  corredorId?: string;
  soloIngresoPagado?: boolean;
}

export function useTransacciones({ limit = 50, corredorId, soloIngresoPagado = false }: UseTransaccionesOptions = {}) {
  const supabase = useSupabaseClient();
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransacciones = useCallback(async () => {
    setLoading(true);

    if (soloIngresoPagado) {
      // Optimización: contar primero, luego disparar todas las páginas en paralelo.
      // Además seleccionamos sólo los campos que /deudas necesita (sin join a corredores)
      // para reducir bytes y tiempo de respuesta.
      const PAGE = 1000;
      const SELECT = "id,corredor_id,tipo,estado,fecha,monto,descripcion,metodo,created_at";
      const { count, error: countErr } = await supabase
        .from("transacciones")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "ingreso")
        .eq("estado", "pagado");
      if (countErr) {
        // eslint-disable-next-line no-console
        console.error("useTransacciones count error:", countErr);
        setError(countErr);
        setLoading(false);
        return;
      }
      const total = count ?? 0;
      if (total === 0) {
        setTransacciones([]);
        setLoading(false);
        return;
      }
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
        if (err) {
          // eslint-disable-next-line no-console
          console.error("useTransacciones soloIngresoPagado error:", err);
          setError(err);
          setLoading(false);
          return;
        }
        all.push(...((data ?? []) as Transaccion[]));
      }
      setTransacciones(all);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("transacciones")
      .select(`*, corredor:corredores(id, nombre)`)
      .order("fecha", { ascending: false })
      .limit(limit);

    if (corredorId) {
      query = query.eq("corredor_id", corredorId);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err);
      setTransacciones([]);
    } else {
      setTransacciones(data ?? []);
    }
    setLoading(false);
  }, [supabase, limit, corredorId, soloIngresoPagado]);

  useEffect(() => {
    fetchTransacciones();

    const channel = supabase
      .channel("transacciones-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transacciones" },
        () => { fetchTransacciones(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTransacciones, supabase]);

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
