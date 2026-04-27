import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Pausa } from "@/types/database";

export function usePausasAll() {
  const supabase = useSupabaseClient();
  const [pausas, setPausas] = useState<Pausa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const PAGE = 1000;
    const { count, error: countErr } = await supabase
      .from("pausas")
      .select("id", { count: "exact", head: true });
    if (countErr) { setPausas([]); setLoading(false); return; }
    const total = count ?? 0;
    if (total === 0) { setPausas([]); setLoading(false); return; }
    const pages = Math.ceil(total / PAGE);
    const reqs = Array.from({ length: pages }, (_, i) =>
      supabase
        .from("pausas")
        .select("*")
        .order("año", { ascending: true })
        .range(i * PAGE, i * PAGE + PAGE - 1)
    );
    const results = await Promise.all(reqs);
    const all: Pausa[] = [];
    for (const { data, error } of results) {
      if (error) { setPausas([]); setLoading(false); return; }
      all.push(...((data ?? []) as Pausa[]));
    }
    setPausas(all);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("pausas-all-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pausas" },
        () => fetchAll()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll, supabase]);

  return { pausas, loading, refetch: fetchAll };
}
