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
  colorIcono = "text-primary",
  children,
}: TarjetaMetricaProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-md flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start">
          <span className="font-label-caps text-outline">{titulo}</span>
          <div className={`w-10 h-10 bg-current/10 rounded-lg flex items-center justify-center ${colorIcono}`}>
            <span className="material-symbols-outlined">{icono}</span>
          </div>
        </div>
        <div className="mt-4">
          <span className="text-4xl font-bold text-on-surface font-body">{valor}</span>
          {tendencia && (
            <div className="flex items-center gap-1 mt-1">
              <span
                className={`material-symbols-outlined text-sm ${
                  tendenciaNegativa ? "text-tertiary" : "text-secondary"
                }`}
              >
                {tendenciaNegativa ? "warning" : "arrow_upward"}
              </span>
              <span
                className={`font-data-mono text-xs ${
                  tendenciaNegativa ? "text-tertiary" : "text-secondary"
                }`}
              >
                {tendencia}
              </span>
            </div>
          )}
        </div>
      </div>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
