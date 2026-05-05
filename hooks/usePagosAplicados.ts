import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { PagoAplicado } from "@/types/database";

// Pagina secuencialmente sin depender del header content-range (algunos
// proxies lo quitan en HEAD, dejando count=null y rindiendo el hook con []).
// Sin realtime subscription: con 5000+ filas, escuchar postgres_changes
// disparaba refetches en bucle durante backfills/syncs y bloqueaba el thread
// principal ("page unresponsive"). Refetch manual via `refetch()` post-acción.
export function usePagosAplicados(corredorId?: string) {
  const supabase = useSupabaseClient();
  const [pagosAplicados, setPagosAplicados] = useState<PagoAplicado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const PAGE = 1000;
    const all: PagoAplicado[] = [];
    let from = 0;
    // Hasta 50 páginas (50k rows) por seguridad. Loop termina al primer page < PAGE.
    for (let i = 0; i < 50; i++) {
      let q = supabase
        .from("pagos_aplicados")
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (corredorId) q = q.eq("corredor_id", corredorId);
      const { data, error } = await q;
      if (error) {
        if (all.length === 0) setPagosAplicados([]);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as PagoAplicado[];
      all.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    setPagosAplicados(all);
    setLoading(false);
  }, [supabase, corredorId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { pagosAplicados, loading, refetch: fetchAll };
}
