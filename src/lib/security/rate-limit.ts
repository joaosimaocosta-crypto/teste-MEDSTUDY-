import "server-only";
import { headers } from "next/headers";

/**
 * Limitador de tentativas simples (janela deslizante, em memória).
 *
 * Protege login, registo e recuperação de senha contra ataques de força bruta,
 * por IP do cliente e por e-mail. Nota: a memória é de cada instância do servidor;
 * numa plataforma com várias instâncias o limite efectivo é por instância (continua
 * a travar ataques simples). O Supabase Auth tem os seus próprios limites (ver README).
 */

type Bucket = number[];
const store = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type Limit = { key: string; max: number; windowMs: number };

/** Regista uma tentativa; devolve false se o limite foi ultrapassado. */
function hit({ key, max, windowMs }: Limit, now = Date.now()) {
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  if (store.size > MAX_KEYS) {
    // limpeza simples para não crescer sem limite
    for (const [k, v] of store) if (v.every((t) => now - t >= windowMs)) store.delete(k);
  }
  return true;
}

/** Verifica vários limites de uma vez (todos têm de passar). */
export function allow(limits: Limit[]) {
  let ok = true;
  for (const l of limits) if (!hit(l)) ok = false;
  return ok;
}

/** IP do cliente, tal como definido pelo servidor/plataforma (primeiro valor). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "desconhecido").trim().slice(0, 64);
}

const MIN = 60_000;

export const LIMITS = {
  login: (ip: string, email: string): Limit[] => [
    { key: `login:ip:${ip}`, max: 20, windowMs: 5 * MIN },
    { key: `login:email:${email}`, max: 8, windowMs: 15 * MIN },
  ],
  register: (ip: string): Limit[] => [{ key: `register:ip:${ip}`, max: 5, windowMs: 60 * MIN }],
  reset: (ip: string, email: string): Limit[] => [
    { key: `reset:ip:${ip}`, max: 5, windowMs: 15 * MIN },
    { key: `reset:email:${email}`, max: 3, windowMs: 60 * MIN },
  ],
};

export const RATE_LIMIT_MESSAGE = "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
