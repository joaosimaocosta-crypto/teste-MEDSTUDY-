import type { BadgeTone } from "@/components/ui/badge";
import type { Database } from "@/types/database";

export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

type SubLike = { status: SubscriptionStatus; starts_at: string | null; expires_at: string | null };

/** Uma assinatura dá acesso AGORA? (mesma regra que a função has_course_access na BD) */
export function isSubscriptionLive(s: SubLike, now = new Date()) {
  return (
    s.status === "active" &&
    s.starts_at !== null &&
    s.expires_at !== null &&
    new Date(s.starts_at) <= now &&
    new Date(s.expires_at) > now
  );
}

/** Estado real: uma assinatura "active" cuja data passou é mostrada como "expired". */
export function effectiveStatus(s: SubLike, now = new Date()): SubscriptionStatus {
  if (s.status === "active" && !isSubscriptionLive(s, now)) {
    return s.expires_at && new Date(s.expires_at) <= now ? "expired" : "pending";
  }
  return s.status;
}

/** Escolhe a assinatura mais relevante de uma lista: activa > pendente > mais recente. */
export function pickCurrentSubscription<T extends SubLike & { created_at: string }>(subs: T[], now = new Date()) {
  const sorted = [...subs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    sorted.find((s) => isSubscriptionLive(s, now)) ?? sorted.find((s) => s.status === "pending") ?? sorted[0] ?? null
  );
}

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus | "none", { label: string; tone: BadgeTone }> = {
  active: { label: "Activa", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  expired: { label: "Expirada", tone: "danger" },
  suspended: { label: "Suspensa", tone: "danger" },
  none: { label: "Sem assinatura", tone: "neutral" },
};
