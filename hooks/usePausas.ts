import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Pausa } from "@/types/database";

export function usePausas(corredorId: string | undefined) {
  const supabase = useSupabaseClient();
  const [pausas, setPausas] = useState<Pausa[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPausas = useCallback(async () => {
    if (!corredorId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pausas")
      .select("*")
      .eq("corredor_id", corredorId)
      .order("año", { ascending: false })
      .order("mes", { ascending: false });
    setPausas(data ?? []);
    setLoading(false);
  }, [supabase, corredorId]);

  useEffect(() => {
    fetchPausas();
  }, [fetchPausas]);

  const addPausa = async (mes: number, año: number, tarifa_mantenimiento: number) => {
    if (!corredorId) return null;
    const { error } = await supabase.from("pausas").insert({
      corredor_id: corredorId,
      mes,
      año,
      tarifa_mantenimiento,
    });
    if (!error) fetchPausas();
    return error;
  };

  const removePausa = async (id: string) => {
    const { error } = await supabase.from("pausas").delete().eq("id", id);
    if (!error) fetchPausas();
    return error;
  };

  return { pausas, loading, addPausa, removePausa, refetch: fetchPausas };
}
