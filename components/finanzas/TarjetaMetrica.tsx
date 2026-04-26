interface TarjetaMetricaProps {
  titulo: string;
  valor: string;
  tendencia?: string;
  tendenciaNegativa?: boolean;
  icono: string;
  colorIcono?: string;
  children?: React.ReactNode;
}

export function TarjetaMetrica({
  titulo,
  valor,
  tendencia,
  tendenciaNegativa = false,
  icono,
  colorIcono = "text-on-surface",
  children,
}: TarjetaMetricaProps) {
  return (
    <div className="bg-white border border-outline-variant/60 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-elev hover:border-outline-variant h-full">
      <div>
        <div className="flex justify-between items-start gap-3">
          <span className="text-label-caps text-on-surface-variant">{titulo}</span>
          <div className={`w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center ${colorIcono}`}>
            <span className="material-symbols-outlined text-[20px]">{icono}</span>
          </div>
        </div>
        <div className="mt-5">
          <span className="text-[34px] font-headline font-bold text-on-surface tracking-tight tabular-nums leading-none">
            {valor}
          </span>
          {tendencia && (
            <div className={`inline-flex items-center gap-1 mt-3 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              tendenciaNegativa
                ? "bg-tertiary-container text-on-tertiary-container"
                : "bg-secondary-container text-on-secondary-container"
            }`}>
              <span className="material-symbols-outlined text-[14px]">
                {tendenciaNegativa ? "warning" : "trending_up"}
              </span>
              <span className="tabular-nums">{tendencia}</span>
            </div>
          )}
        </div>
      </div>
      {children && <div className="mt-5 pt-5 border-t border-outline-variant/40">{children}</div>}
    </div>
  );
}
