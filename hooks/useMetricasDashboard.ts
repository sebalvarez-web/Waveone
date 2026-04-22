import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

interface MetricasDashboard {
  totalCorredoresActivos: number;
  ingresosMes: number;
  ingresosMesAnterior: number;
  gastosPendientes: number;
  cantidadGastosPendientes: number;
  ingresosStripe: number;
  ingresosPaypal: number;
}

export function useMetricasDashboard() {
  const supabase = useSupabaseClient();
  const [metricas, setMetricas] = useState<MetricasDashboard>({
    totalCorredoresActivos: 0,
    ingresosMes: 0,
    ingresosMesAnterior: 0,
    gastosPendientes: 0,
    cantidadGastosPendientes: 0,
    ingresosStripe: 0,
    ingresosPaypal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetricas() {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .split("T")[0];
      const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .split("T")[0];

      const [
        { count: activos },
        { data: ingresosMesData },
        { data: ingresosMesAnteriorData },
        { data: gastosPendientesData },
      ] = await Promise.all([
        supabase
          .from("corredores")
          .select("*", { count: "exact", head: true })
          .eq("estado", "activo"),
        supabase
          .from("transacciones")
          .select("monto, metodo")
          .eq("tipo", "ingreso")
          .eq("estado", "pagado")
          .gte("fecha", inicioMes),
        supabase
          .from("transacciones")
          .select("monto")
          .eq("tipo", "ingreso")
          .eq("estado", "pagado")
          .gte("fecha", inicioMesAnterior)
          .lte("fecha", finMesAnterior),
        supabase
          .from("transacciones")
          .select("monto")
          .eq("tipo", "gasto")
          .eq("estado", "pendiente"),
      ]);

      const ingresosMes = (ingresosMesData ?? []).reduce(
        (sum, t) => sum + Number(t.monto), 0
      );
      const ingresosMesAnterior = (ingresosMesAnteriorData ?? []).reduce(
        (sum, t) => sum + Number(t.monto), 0
      );
      const gastosPendientes = (gastosPendientesData ?? []).reduce(
        (sum, t) => sum + Number(t.monto), 0
      );
      const ingresosStripe = (ingresosMesData ?? [])
        .filter((t) => t.metodo === "stripe")
        .reduce((sum, t) => sum + Number(t.monto), 0);
      const ingresosPaypal = (ingresosMesData ?? [])
        .filter((t) => t.metodo === "paypal")
        .reduce((sum, t) => sum + Number(t.monto), 0);

      setMetricas({
        totalCorredoresActivos: activos ?? 0,
        ingresosMes,
        ingresosMesAnterior,
        gastosPendientes,
        cantidadGastosPendientes: gastosPendientesData?.length ?? 0,
        ingresosStripe,
        ingresosPaypal,
      });
      setLoading(false);
    }

    fetchMetricas();
  }, [supabase]);

  return { metricas, loading };
}
