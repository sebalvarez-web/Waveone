import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { CambioPlan } from "@/lib/deudas";

/**
 * Carga los registros `cambio_plan` de `corredor_historial`.
 * Si `corredorId` es undefined, trae todos (para vistas globales como /deudas).
 */
export function useCambiosPlan(corredorId?: string) {
  const supabase = useSupabaseClient();
  const [cambios, setCambios] = useState<CambioPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCambios = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("corredor_historial")
      .select("corredor_id, fecha, plan_id_anterior, plan_id_nuevo")
      .eq("tipo", "cambio_plan");
    if (corredorId) q = q.eq("corredor_id", corredorId);

    const { data } = await q;
    setCambios((data as CambioPlan[]) ?? []);
    setLoading(false);
  }, [supabase, corredorId]);

  useEffect(() => {
    fetchCambios();
  }, [fetchCambios]);

  return { cambios, loading, refetch: fetchCambios };
}
