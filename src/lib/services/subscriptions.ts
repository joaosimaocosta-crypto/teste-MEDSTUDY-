import "server-only";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { effectiveStatus, pickCurrentSubscription, type SubscriptionStatus } from "@/lib/subscriptions";

/** Assinaturas, planos e pagamentos. Leitura com a sessão do utilizador (RLS). */

const DAY_MS = 86_400_000;

// =============================================================================
// Estudante
// =============================================================================
export async function getMySubscriptionPage() {
  const user = await requireUser("/assinatura");
  const supabase = await createClient();
  const [plans, subs, payments, settings] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("id, name, description, price_mzn, duration_days, features, course:courses(title)")
      .eq("is_active", true)
      .order("position")
      .order("price_mzn"),
    supabase
      .from("subscriptions")
      .select("id, status, starts_at, expires_at, created_at, notes, plan:subscription_plans(name, price_mzn, duration_days)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount_mzn, method, reference, status, paid_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("app_settings").select("payment_instructions, support_contact").maybeSingle(),
  ]);
  for (const r of [plans, subs, payments, settings]) if (r.error) console.error("[assinatura]", r.error.message);

  const list = (subs.data ?? []).map((s) => ({ ...s, effective: effectiveStatus(s) }));
  const current = pickCurrentSubscription(subs.data ?? []);
  const now = Date.now();

  return {
    plans: plans.data ?? [],
    subscriptions: list,
    current: current
      ? {
          ...current,
          effective: effectiveStatus(current),
          daysLeft:
            current.expires_at && effectiveStatus(current) === "active"
              ? Math.max(0, Math.ceil((new Date(current.expires_at).getTime() - now) / DAY_MS))
              : null,
        }
      : null,
    pending: list.find((s) => s.status === "pending") ?? null,
    payments: payments.data ?? [],
    settings: settings.data ?? { payment_instructions: null, support_contact: null },
  };
}

// =============================================================================
// Administração
// =============================================================================
export async function listPlansForAdmin() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: plans, error }, { data: courses }, { data: settings }] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("id, name, slug, description, price_mzn, duration_days, features, course_id, is_active, position, subscriptions(count)")
      .order("position")
      .order("created_at"),
    supabase.from("courses").select("id, title").order("position"),
    supabase.from("app_settings").select("payment_instructions, support_contact, updated_at").maybeSingle(),
  ]);
  if (error) console.error("[planos]", error.message);
  return {
    plans: (plans ?? []).map((p) => ({
      ...p,
      subscriptionCount: (p.subscriptions as unknown as { count: number }[])[0]?.count ?? 0,
    })),
    courses: courses ?? [],
    settings: settings ?? { payment_instructions: null, support_contact: null, updated_at: null },
  };
}

export type SubscriptionFilter = "pending" | "active" | "expiring" | "expired" | "suspended" | "all";

export async function listSubscriptionsForAdmin(filter: SubscriptionFilter, q: string) {
  await requireAdmin();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const in7 = new Date(Date.now() + 7 * DAY_MS).toISOString();

  let query = supabase
    .from("subscriptions")
    .select(
      "id, status, starts_at, expires_at, created_at, notes, plan:subscription_plans(id, name, price_mzn), student:profiles!subscriptions_user_id_fkey!inner(id, full_name, email)",
    )
    .order("created_at", { ascending: filter === "pending" })
    .limit(200);

  if (filter === "pending") query = query.eq("status", "pending");
  if (filter === "suspended") query = query.eq("status", "suspended");
  if (filter === "active") query = query.eq("status", "active").gt("expires_at", nowIso);
  if (filter === "expiring") query = query.eq("status", "active").gt("expires_at", nowIso).lte("expires_at", in7);
  if (filter === "expired") query = query.or(`status.eq.expired,and(status.eq.active,expires_at.lte.${nowIso})`);

  const term = q.replace(/[,()*%\\:"']/g, " ").trim().slice(0, 80);
  if (term) query = query.or(`full_name.ilike.*${term}*,email.ilike.*${term}*`, { referencedTable: "student" });

  const { data, error } = await query;
  if (error) console.error("[assinaturas]", error.message);

  const counts = await Promise.all(
    (["pending", "suspended"] as const).map(async (s) => {
      const { count } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", s);
      return [s, count ?? 0] as const;
    }),
  );
  const { count: expiring } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .lte("expires_at", in7);

  return {
    rows: (data ?? []).map((s) => ({ ...s, effective: effectiveStatus(s) as SubscriptionStatus })),
    counts: { ...Object.fromEntries(counts), expiring: expiring ?? 0 } as Record<"pending" | "suspended" | "expiring", number>,
  };
}

export async function listPaymentsForAdmin(filters: { month: string | null; method: string | null; q: string }) {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select(
      "id, amount_mzn, method, reference, status, paid_at, created_at, notes, plan:subscription_plans(name), student:profiles!payments_user_id_fkey!inner(id, full_name, email), recorder:profiles!payments_recorded_by_fkey(full_name)",
    )
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    const [y, m] = filters.month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    query = query.gte("paid_at", `${filters.month}-01T00:00:00+02:00`).lt("paid_at", `${next}-01T00:00:00+02:00`);
  }
  if (filters.method) query = query.eq("method", filters.method as "mpesa");
  const term = filters.q.replace(/[,()*%\\:"']/g, " ").trim().slice(0, 80);
  if (term) query = query.or(`full_name.ilike.*${term}*,email.ilike.*${term}*`, { referencedTable: "student" });

  const [{ data, error }, { data: plans }] = await Promise.all([
    query,
    supabase.from("subscription_plans").select("id, name, price_mzn, is_active").order("position"),
  ]);
  if (error) console.error("[pagamentos]", error.message);
  const rows = data ?? [];
  return {
    rows,
    plans: plans ?? [],
    total: rows.filter((r) => r.status === "confirmed").reduce((s, r) => s + Number(r.amount_mzn), 0),
    currentMonth: dayKey(new Date()).slice(0, 7),
  };
}

export async function getAssignOptions() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("subscription_plans").select("id, name, price_mzn, is_active").order("position");
  return data ?? [];
}
