/**
 * Formatação de datas e números em português, no fuso horário de Moçambique.
 * (Usar sempre estas funções para que servidor e browser mostrem o mesmo.)
 */

export const TIME_ZONE = "Africa/Maputo";
const LOCALE = "pt-PT";

/** Chave do dia "AAAA-MM-DD" no fuso de Moçambique. */
export function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Seg", "Ter", ... (abreviaturas fixas: o Intl em pt-PT devolve nomes completos). */
export function weekdayShort(date: Date) {
  const [y, m, d] = dayKey(date).split("-").map(Number);
  return WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "sexta-feira, 13 de novembro" */
export function longDate(date: Date) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** "13/11/2026" */
export function shortDate(value: string | Date) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

/** Número com separadores portugueses (1 284). */
export function formatNumber(n: number) {
  return new Intl.NumberFormat(LOCALE).format(n);
}

/** "+258841234567" → "84 123 4567" (para mostrar num campo de formulário). */
export function formatPhoneForInput(phone: string | null) {
  if (!phone) return "";
  const local = phone.replace(/^\+?258/, "");
  return /^\d{9}$/.test(local) ? `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}` : phone;
}
