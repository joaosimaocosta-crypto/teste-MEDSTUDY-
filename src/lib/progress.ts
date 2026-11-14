import { dayKey } from "@/lib/format";

/**
 * Cálculos de progresso (funções puras, partilhadas por estudante e administração).
 * Os dias estão no formato "AAAA-MM-DD", no fuso horário de Moçambique.
 */

export type ActivityDay = {
  day: string;
  lessons_viewed: number;
  lessons_completed: number;
  quizzes_submitted: number;
};

const DAY_MS = 86_400_000;

/** Soma de acções num dia (aberturas + conclusões + testes). */
export const activityCount = (d: ActivityDay) => d.lessons_viewed + d.lessons_completed + d.quizzes_submitted;

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Sequência actual: dias seguidos com actividade até hoje.
 * Se hoje ainda não estudou, a sequência de ontem continua válida (não se perde a meio do dia).
 */
export function computeStreaks(days: ActivityDay[], now = new Date()) {
  const active = new Set(days.filter((d) => activityCount(d) > 0).map((d) => d.day));
  const today = dayKey(now);

  let current = 0;
  let cursor = active.has(today) ? today : addDays(today, -1);
  while (active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of [...active].sort()) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }

  const since30 = addDays(today, -29);
  const last30 = [...active].filter((d) => d >= since30).length;
  return { current, best, last30, studiedToday: active.has(today) };
}

export type HeatCell = { day: string; count: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };

/**
 * Mapa de actividade: `weeks` semanas (colunas), de segunda a domingo (linhas).
 * Níveis 0–4 relativos ao máximo do período (escala sequencial).
 */
export function buildHeatmap(days: ActivityDay[], weeks = 12, now = new Date()) {
  const byDay = new Map(days.map((d) => [d.day, activityCount(d)]));
  const today = dayKey(now);
  const [y, m, d] = today.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = segunda
  const start = addDays(today, -weekday - (weeks - 1) * 7);

  const counts: number[] = [];
  const columns: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, w * 7 + i);
      const count = byDay.get(day) ?? 0;
      counts.push(count);
      col.push({ day, count, level: 0, future: day > today });
    }
    columns.push(col);
  }
  const max = Math.max(...counts, 0);
  for (const col of columns) {
    for (const cell of col) {
      if (cell.count > 0 && max > 0) {
        cell.level = Math.min(4, Math.max(1, Math.ceil((cell.count / max) * 4))) as HeatCell["level"];
      }
    }
  }
  return { columns, max };
}

/** "3 h 20 min" / "45 min" */
export function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
