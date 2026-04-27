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
    // Count primero, luego páginas en paralelo
    let countQ = supabase
      .from("pagos_aplicados")
      .select("id", { count: "exact", head: true });
    if (corredorId) countQ = countQ.eq("corredor_id", corredorId);
    const { count, error: countErr } = await countQ;
    if (countErr) { setPagosAplicados([]); setLoading(false); return; }
    const total = count ?? 0;
    if (total === 0) { setPagosAplicados([]); setLoading(false); return; }
    const pages = Math.ceil(total / PAGE);
    const reqs = Array.from({ length: pages }, (_, i) => {
      let q = supabase
        .from("pagos_aplicados")
        .select("*")
        .order("created_at", { ascending: true })
        .range(i * PAGE, i * PAGE + PAGE - 1);
      if (corredorId) q = q.eq("corredor_id", corredorId);
      return q;
    });
    const results = await Promise.all(reqs);
    const all: PagoAplicado[] = [];
    for (const { data, error } of results) {
      if (error) { setPagosAplicados([]); setLoading(false); return; }
      all.push(...((data ?? []) as PagoAplicado[]));
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
