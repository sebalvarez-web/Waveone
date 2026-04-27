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
    const all: Pausa[] = [];
    let from = 0;
    for (let i = 0; i < 200; i++) {
      const { data, error } = await supabase
        .from("pausas")
        .select("*")
        .order("año", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { setPausas([]); setLoading(false); return; }
      const batch = (data ?? []) as Pausa[];
      all.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;
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
