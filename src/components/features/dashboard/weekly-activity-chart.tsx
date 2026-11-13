"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Day = { date: string; label: string; lessons: number };

/**
 * Gráfico de colunas — aulas concluídas por dia (últimos 7 dias).
 * Uma só série: sem legenda (o título do cartão diz o que é mostrado).
 *  - Colunas finas (≤ 24px), topo arredondado, base recta numa linha de base comum.
 *  - Tooltip ao passar o rato / tocar / focar com o teclado (o alvo é a coluna inteira).
 *  - Tabela equivalente para leitores de ecrã.
 */
export function WeeklyActivityChart({ data }: { data: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.lessons), 0);
  const top = niceMax(max);
  const total = data.reduce((s, d) => s + d.lessons, 0);
  const today = data.length - 1;

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative h-40" onMouseLeave={() => setActive(null)}>
        {/* Linhas de grelha: topo e base (hairline, recessivas) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2" aria-hidden>
          <span className="w-5 text-right text-[11px] text-muted-foreground tabular-nums">{top}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex items-center gap-2" aria-hidden>
          <span className="w-5 text-right text-[11px] text-muted-foreground tabular-nums">{top / 2}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="absolute inset-y-0 left-7 right-0 flex items-end border-b border-border">
          {data.map((d, i) => {
            const height = top > 0 ? (d.lessons / top) * 100 : 0;
            return (
              <button
                key={d.date}
                type="button"
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
                aria-label={`${d.label}: ${d.lessons} ${d.lessons === 1 ? "aula" : "aulas"}`}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <span
                  className={cn(
                    "w-full max-w-6 rounded-t bg-chart-1 transition",
                    active === i ? "opacity-100 brightness-110" : active !== null ? "opacity-60" : "opacity-100",
                    "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring",
                  )}
                  style={{ height: d.lessons > 0 ? `max(${height}%, 4px)` : "0" }}
                />
                {active === i && (
                  <span
                    role="tooltip"
                    className="absolute z-10 rounded-lg border border-border bg-card px-2.5 py-1.5 text-center shadow-md"
                    style={{ bottom: `calc(${height}% + 4px)` }}
                  >
                    <span className="block text-sm font-semibold tabular-nums">{d.lessons}</span>
                    <span className="block whitespace-nowrap text-[11px] text-muted-foreground">
                      {d.lessons === 1 ? "aula" : "aulas"} · {d.label}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {total === 0 && (
          <p className="absolute inset-x-7 top-1/3 text-center text-sm text-muted-foreground">
            Ainda sem aulas concluídas esta semana.
          </p>
        )}
      </div>

      {/* Eixo X */}
      <div className="ml-7 flex" aria-hidden>
        {data.map((d, i) => (
          <span
            key={d.date}
            className={cn(
              "flex-1 text-center text-[11px]",
              i === today ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {i === today ? "Hoje" : d.label}
          </span>
        ))}
      </div>

      {/* Versão em tabela (acessibilidade) */}
      <table className="sr-only">
        <caption>Aulas concluídas por dia nos últimos 7 dias</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Aulas concluídas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.label}</td>
              <td>{d.lessons}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Topo do eixo arredondado para um número "limpo" e par (2, 4, 6, 10, 20…). */
function niceMax(max: number) {
  if (max <= 2) return 2;
  if (max <= 4) return 4;
  if (max <= 6) return 6;
  if (max <= 10) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / pow) * pow + ((Math.ceil(max / pow) * pow) % 2 ? pow : 0);
}
