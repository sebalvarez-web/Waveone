import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { HistorialItem } from "@/types/database";

export function useHistorialCorredor(corredorId: string) {
  const supabase = useSupabaseClient();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!corredorId) return;

    async function fetch() {
      setLoading(true);
      setError(null);

      const [{ data: hData, error: hErr }, { data: pData, error: pErr }] = await Promise.all([
        supabase
          .from("corredor_historial")
          .select(`
            *,
            plan_anterior:plan_id_anterior(id, nombre),
            plan_nuevo:plan_id_nuevo(id, nombre),
            creado_por_user:creado_por(id, nombre)
          `)
          .eq("corredor_id", corredorId)
          .order("fecha", { ascending: false }),
        supabase
          .from("pausas")
          .select("*")
          .eq("corredor_id", corredorId),
      ]);

      if (hErr || pErr) {
        setError(hErr ?? pErr);
        setLoading(false);
        return;
      }

      const historialItems: HistorialItem[] = (hData ?? []).map((h: Record<string, unknown>) => ({
        id: h.id as string,
        corredor_id: h.corredor_id as string,
        fecha: h.fecha as string,
        tipo: h.tipo as HistorialItem["tipo"],
        plan_anterior: (h.plan_anterior as { id: string; nombre: string } | null) ?? null,
        plan_nuevo: (h.plan_nuevo as { id: string; nombre: string } | null) ?? null,
        estado_anterior: (h.estado_anterior as HistorialItem["estado_anterior"]) ?? null,
        estado_nuevo: (h.estado_nuevo as HistorialItem["estado_nuevo"]) ?? null,
        mes: null,
        año: null,
        tarifa_mantenimiento: null,
        nota: (h.nota as string | null) ?? null,
        creado_por_user: (h.creado_por_user as { id: string; nombre: string } | null) ?? null,
      }));

      const pausaItems: HistorialItem[] = (pData ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        corredor_id: p.corredor_id as string,
        fecha: (p.año && p.mes) ? `${p.año}-${String(p.mes as number).padStart(2, "0")}-01T00:00:00Z` : new Date(0).toISOString(),
        tipo: "pausa" as const,
        plan_anterior: null,
        plan_nuevo: null,
        estado_anterior: null,
        estado_nuevo: null,
        mes: p.mes as number,
        año: p.año as number,
        tarifa_mantenimiento: p.tarifa_mantenimiento as number,
        nota: null,
        creado_por_user: null,
      }));

      const merged = [...historialItems, ...pausaItems].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      setHistorial(merged);
      setLoading(false);
    }

    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corredorId]);

  return { historial, loading, error };
}
