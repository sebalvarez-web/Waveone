import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Transaccion } from "@/types/database";

interface UseTransaccionesOptions {
  limit?: number;
  corredorId?: string;
}

export function useTransacciones({ limit = 50, corredorId }: UseTransaccionesOptions = {}) {
  const supabase = useSupabaseClient();
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransacciones = useCallback(async () => {
    setLoading(true);
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
  }, [supabase, limit, corredorId]);

  useEffect(() => {
    fetchTransacciones();
  }, [fetchTransacciones]);

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
