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
      // Paginar en batches de 1000 para evitar el max-rows default de Supabase
      const PAGE = 1000;
      const all: Transaccion[] = [];
      let from = 0;
      // Loop hasta que un batch venga incompleto (= ya no hay más filas)
      // Cap de seguridad: 200 páginas (200k filas)
      for (let i = 0; i < 200; i++) {
        const { data, error: err } = await supabase
          .from("transacciones")
          .select(`*, corredor:corredores(id, nombre)`)
          .eq("tipo", "ingreso")
          .eq("estado", "pagado")
          .order("fecha", { ascending: false })
          .range(from, from + PAGE - 1);
        if (err) {
          setError(err);
          setTransacciones([]);
          setLoading(false);
          return;
        }
        const batch = data ?? [];
        all.push(...(batch as Transaccion[]));
        if (batch.length < PAGE) break;
        from += PAGE;
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
