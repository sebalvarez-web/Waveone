import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import type { Plan } from "@/types/database";

export function usePlanes() {
  const supabase = useSupabaseClient();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("planes")
      .select("*")
      .order("precio_mensual")
      .then(({ data }) => {
        setPlanes(data ?? []);
        setLoading(false);
      });
  }, [supabase]);

  return { planes, loading };
}
