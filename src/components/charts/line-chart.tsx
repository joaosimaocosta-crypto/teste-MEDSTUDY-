"use client";

import { useEffect, useRef, useState } from "react";
import { shortDate } from "@/lib/format";

export type LinePoint = { key: string; label: string; title: string; value: number; passed: boolean };

const HEIGHT = 200;
const PAD = { top: 16, right: 44, bottom: 28, left: 34 };

/**
 * Gráfico de linha (uma série): evolução das notas nos testes, 0–100%.
 *  - Linha 2px, marcadores ≥ 8px com anel da cor da superfície, área com ~10% de opacidade.
 *  - Mira vertical que segue o ponteiro e "salta" para o ponto mais próximo.
 *  - Valor da última tentativa escrito no fim da linha; tabela para leitores de ecrã.
 */
export function LineChart({ data }: { data: LinePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / 100) * innerH;

  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = data.length ? `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const last = data.length - 1;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setActive(best);
  }

  const a = active !== null ? data[active] : null;

  return (
    <figure className="flex flex-col gap-2">
      <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            className="touch-none select-none"
            onPointerMove={onMove}
            onPointerDown={onMove}
            // Com o dedo, o browser envia "pointerleave" logo após o toque: só o rato esconde
            // o tooltip ao sair; no telemóvel fica visível até tocar noutro ponto.
            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
            aria-hidden
          >
            {/* grelha 0 / 50 / 100 % */}
            {[0, 50, 100].map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                  {v}%
                </text>
              </g>
            ))}
            <path d={area} className="fill-chart-1" opacity={0.1} />
            <path d={line} className="stroke-chart-1" fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-muted-foreground" strokeWidth={1} />
            )}
            {data.map((d, i) => (
              <circle
                key={d.key}
                cx={x(i)}
                cy={y(d.value)}
                r={active === i ? 6 : 4}
                className="fill-chart-1 stroke-card"
                strokeWidth={2}
              />
            ))}
            {/* rótulo directo: só a última tentativa */}
            {last >= 0 && (
              <text x={x(last) + 9} y={y(data[last].value)} dy="0.32em" className="fill-foreground text-xs font-semibold tabular-nums">
                {data[last].value}%
              </text>
            )}
          </svg>
        )}

        {a && active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
            style={{ left: Math.min(Math.max(x(active), 70), width - 70), top: 0 }}
          >
            <p className="text-base font-semibold tabular-nums">{a.value}%</p>
            <p className="max-w-44 truncate text-muted-foreground">{a.title}</p>
            <p className="text-muted-foreground">
              {a.label ? shortDate(a.label) : ""} · {a.passed ? "Aprovado" : "Reprovado"}
            </p>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Resultados dos testes por ordem cronológica</caption>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Teste</th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <td>{d.label ? shortDate(d.label) : "—"}</td>
              <td>{d.title}</td>
              <td>
                {d.value}% ({d.passed ? "aprovado" : "reprovado"})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
