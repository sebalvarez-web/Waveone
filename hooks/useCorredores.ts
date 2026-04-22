import { useEffect, useState, useCallback } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Corredor } from "@/types/database";

interface UseCorredoresOptions {
  search?: string;
}

export function useCorredores({ search = "" }: UseCorredoresOptions = {}) {
  const supabase = useSupabaseClient();
  const [corredores, setCorredores] = useState<Corredor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCorredores = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("corredores")
      .select(`
        *,
        plan:planes(id, nombre, precio_mensual),
        entrenador:users(id, nombre, email)
      `)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("nombre", `%${search}%`);
    }

    const { data, error: err } = await query;

    if (err) {
      setError(err);
      setCorredores([]);
    } else {
      setCorredores(data ?? []);
    }
    setLoading(false);
  }, [supabase, search]);

  useEffect(() => {
    fetchCorredores();
  }, [fetchCorredores]);

  const deleteCorredor = async (id: string) => {
    const { error: err } = await supabase
      .from("corredores")
      .delete()
      .eq("id", id);
    if (!err) fetchCorredores();
    return err;
  };

  return { corredores, loading, error, refetch: fetchCorredores, deleteCorredor };
}
