import type { LucideIcon } from "lucide-react";

/**
 * Indicador numérico (KPI): etiqueta, valor e nota opcional.
 * Um único número lê-se melhor assim do que num gráfico.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium sm:text-sm">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
