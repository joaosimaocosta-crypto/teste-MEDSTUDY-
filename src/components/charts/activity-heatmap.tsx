import type { HeatCell } from "@/lib/progress";
import { cn } from "@/lib/utils";

const LEVEL_CLASS = ["bg-muted", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;
const WEEKDAYS = ["Seg", "", "Qua", "", "Sex", "", "Dom"];

function cellLabel(c: HeatCell) {
  const [y, m, d] = c.day.split("-");
  const date = `${d}/${m}/${y}`;
  if (c.future) return date;
  return c.count === 0 ? `${date}: sem actividade` : `${date}: ${c.count} ${c.count === 1 ? "acção" : "acções"} de estudo`;
}

/**
 * Mapa de actividade (estilo calendário): cada quadrado é um dia.
 * Escala sequencial de um só tom (mais escuro = mais actividade), com legenda e
 * descrição textual em cada dia (title + aria-label) — a cor nunca é a única pista.
 */
export function ActivityHeatmap({ columns }: { columns: HeatCell[][] }) {
  const active = columns.flat().filter((c) => c.count > 0 && !c.future).length;
  return (
    <figure className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-1 pr-1 text-[10px] leading-none text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="flex h-3.5 items-center sm:h-4">
              {w}
            </span>
          ))}
        </div>
        <div className="flex gap-1" role="img" aria-label={`Actividade nas últimas ${columns.length} semanas: ${active} dias com estudo.`}>
          {columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((c) => (
                <span
                  key={c.day}
                  title={cellLabel(c)}
                  className={cn(
                    "size-3.5 rounded-[3px] sm:size-4",
                    c.future ? "bg-transparent" : LEVEL_CLASS[c.level],
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        Menos
        {LEVEL_CLASS.map((cls) => (
          <span key={cls} className={cn("size-3 rounded-[3px]", cls)} aria-hidden />
        ))}
        Mais
      </figcaption>
    </figure>
  );
}
