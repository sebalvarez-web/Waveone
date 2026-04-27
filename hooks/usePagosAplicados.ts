import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { PagoAplicado } from "@/types/database";

export function usePagosAplicados(corredorId?: string) {
  const supabase = useSupabaseClient();
  const [pagosAplicados, setPagosAplicados] = useState<PagoAplicado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const PAGE = 1000;
    const all: PagoAplicado[] = [];
    let from = 0;
    for (let i = 0; i < 200; i++) {
      let q = supabase
        .from("pagos_aplicados")
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (corredorId) q = q.eq("corredor_id", corredorId);
      const { data, error } = await q;
      if (error) { setPagosAplicados([]); setLoading(false); return; }
      const batch = (data ?? []) as PagoAplicado[];
      all.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;
    }
    setPagosAplicados(all);
    setLoading(false);
  }, [supabase, corredorId]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("pagos-aplicados-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pagos_aplicados" },
        () => fetchAll()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll, supabase]);

  return { pagosAplicados, loading, refetch: fetchAll };
}
