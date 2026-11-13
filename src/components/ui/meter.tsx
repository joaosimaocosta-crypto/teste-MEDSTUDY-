/**
 * Barra de progresso (meter): o preenchimento usa --chart-1 e a pista um tom
 * mais claro do mesmo verde (--chart-track). Acessível como role="progressbar".
 */
export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-chart-track"
    >
      <div className="h-full rounded-full bg-chart-1 transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
