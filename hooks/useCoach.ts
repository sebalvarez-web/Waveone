import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Coach, Corredor, Transaccion, HistorialItem } from "@/types/database";

export interface CoachStats {
  coach: Coach;
  corredores: Corredor[];
  transacciones: Transaccion[];
  historial: HistorialItem[];
  totalActivos: number;
  ingresosMes: number;
}

export function useCoach(coachId: string | undefined) {
  const supabase = useSupabaseClient();
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCoach = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    const inicioMesStr = inicioMes.toISOString().split("T")[0];

    const [{ data: coach }, { data: corredores }] = await Promise.all([
      supabase.from("coaches").select("*").eq("id", coachId).single(),
      supabase
        .from("corredores")
        .select("*, plan:planes(id, nombre, precio_mensual)")
        .eq("entrenador_id", coachId),
    ]);

    if (!coach || !corredores) { setLoading(false); return; }

    const corredorIds = corredores.map((c) => c.id);

    const [{ data: transacciones }, { data: historial }] = await Promise.all([
      corredorIds.length > 0
        ? supabase
            .from("transacciones")
            .select("*, corredor:corredores(id, nombre)")
            .in("corredor_id", corredorIds)
            .eq("tipo", "ingreso")
            .eq("estado", "pagado")
            .gte("fecha", inicioMesStr)
        : Promise.resolve({ data: [] }),
      corredorIds.length > 0
        ? supabase
            .from("historial_corredores")
            .select("*, creado_por_user:users(id, nombre)")
            .in("corredor_id", corredorIds)
            .order("fecha", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

    setStats({
      coach: coach as Coach,
      corredores: corredores as Corredor[],
      transacciones: (transacciones ?? []) as Transaccion[],
      historial: (historial ?? []) as HistorialItem[],
      totalActivos: corredores.filter((c) => c.estado === "activo").length,
      ingresosMes: (transacciones ?? []).reduce((s, t) => s + Number(t.monto), 0),
    });
    setLoading(false);
  }, [supabase, coachId]);

  useEffect(() => { fetchCoach(); }, [fetchCoach]);

  return { stats, loading };
}
