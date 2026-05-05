import { useEffect, useState, useCallback, useRef } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { PagoAplicado } from "@/types/database";

// Pagina secuencialmente sin depender del header content-range. Algunos
// proxies/edges quitan ese header en HEAD requests y count viene null,
// haciendo que el hook se rindiera con [] aunque la tabla tuviera filas.
// Loop hasta que una página venga incompleta.
export function usePagosAplicados(corredorId?: string) {
  const supabase = useSupabaseClient();
  const [pagosAplicados, setPagosAplicados] = useState<PagoAplicado[]>([]);
  const [loading, setLoading] = useState(true);
  // Channel name único para evitar colisión cuando el hook se monta más
  // de una vez en la misma sesión (ej. /pagos + /corredores/[id] con HMR).
  const channelIdRef = useRef(
    `pa-${corredorId ?? "all"}-${Math.random().toString(36).slice(2, 8)}`
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const PAGE = 1000;
    const all: PagoAplicado[] = [];
    let from = 0;
    // Bucle hasta que una página devuelva menos de PAGE filas (= última página).
    // Sin necesidad de count previo. Maximo 50 páginas (50k rows) por seguridad.
    for (let i = 0; i < 50; i++) {
      let q = supabase
        .from("pagos_aplicados")
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (corredorId) q = q.eq("corredor_id", corredorId);
      const { data, error } = await q;
      if (error) {
        // No vaciamos el array si ya teníamos data parcial — preserva resilencia.
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
    const channel = supabase
      .channel(channelIdRef.current)
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
