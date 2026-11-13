import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { effectiveStatus, pickCurrentSubscription, type SubscriptionStatus } from "@/lib/subscriptions";
import type { Database } from "@/types/database";

/**
 * Consultas da área administrativa.
 * Cada função chama requireAdmin() (defesa em profundidade) e usa o cliente com a
 * sessão do administrador — as políticas RLS "admin gere" autorizam a leitura.
 * Nunca se usa a chave secreta aqui.
 */

const DAY_MS = 86_400_000;
type UserRole = Database["public"]["Enums"]["user_role"];

function logError(scope: string, error: { message: string } | null) {
  if (error) console.error(`[admin] ${scope}:`, error.message);
}

// =============================================================================
// Visão geral
// =============================================================================
export async function getAdminOverview() {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const since56 = new Date(now.getTime() - 56 * DAY_MS).toISOString();
  const in7 = new Date(now.getTime() + 7 * DAY_MS).toISOString();
  const monthStart = `${dayKey(now).slice(0, 7)}-01T00:00:00+02:00`; // início do mês (hora de Maputo)

  const count = { count: "exact" as const, head: true };
  const [
    students,
    newStudents,
    activeSubs,
    pendingSubs,
    expiringSubs,
    courses,
    lessons,
    manuals,
    quizzes,
    attempts30,
    paymentsMonth,
    signups,
    pendingList,
    recentStudents,
  ] = await Promise.all([
    supabase.from("profiles").select("id", count).eq("role", "student"),
    supabase.from("profiles").select("id", count).eq("role", "student").gte("created_at", since30),
    supabase.from("subscriptions").select("id", count).eq("status", "active").lte("starts_at", nowIso).gt("expires_at", nowIso),
    supabase.from("subscriptions").select("id", count).eq("status", "pending"),
    supabase.from("subscriptions").select("id", count).eq("status", "active").gt("expires_at", nowIso).lte("expires_at", in7),
    supabase.from("courses").select("id", count).eq("status", "published"),
    supabase.from("lessons").select("id", count).eq("status", "published"),
    supabase.from("manuals").select("id", count).eq("status", "published"),
    supabase.from("quizzes").select("id", count).eq("status", "published"),
    supabase.from("quiz_attempts").select("id", count).neq("status", "in_progress").gte("submitted_at", since30),
    supabase.from("payments").select("amount_mzn").eq("status", "confirmed").gte("paid_at", monthStart),
    supabase.from("profiles").select("created_at").eq("role", "student").gte("created_at", since56),
    supabase
      .from("subscriptions")
      .select("id, created_at, plan:subscription_plans(name), student:profiles!subscriptions_user_id_fkey(id, full_name, email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  [students, newStudents, activeSubs, pendingSubs, expiringSubs, courses, lessons, manuals, quizzes, attempts30, paymentsMonth, signups, pendingList, recentStudents].forEach(
    (r, i) => logError(`overview[${i}]`, r.error),
  );

  // Registos por semana (8 semanas, a última termina hoje)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now.getTime() - (7 - i) * 7 * DAY_MS);
    const start = new Date(end.getTime() - 6 * DAY_MS);
    return { start: dayKey(start), end: dayKey(end), value: 0 };
  });
  for (const row of signups.data ?? []) {
    const key = dayKey(new Date(row.created_at));
    const w = weeks.find((wk) => key >= wk.start && key <= wk.end);
    if (w) w.value += 1;
  }

  return {
    stats: {
      students: students.count ?? 0,
      newStudents30: newStudents.count ?? 0,
      activeSubscriptions: activeSubs.count ?? 0,
      pendingSubscriptions: pendingSubs.count ?? 0,
      expiringIn7: expiringSubs.count ?? 0,
      attempts30: attempts30.count ?? 0,
      revenueMonth: (paymentsMonth.data ?? []).reduce((s, p) => s + Number(p.amount_mzn), 0),
    },
    content: {
      courses: courses.count ?? 0,
      lessons: lessons.count ?? 0,
      manuals: manuals.count ?? 0,
      quizzes: quizzes.count ?? 0,
    },
    weeklySignups: weeks.map((w) => ({
      key: w.start,
      label: `${w.start.slice(8, 10)}/${w.start.slice(5, 7)}`,
      value: w.value,
    })),
    pendingRequests: (pendingList.data ?? []).map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      planName: s.plan?.name ?? "—",
      studentId: s.student?.id ?? "",
      studentName: s.student?.full_name || s.student?.email || "—",
    })),
    recentStudents: recentStudents.data ?? [],
  };
}

// =============================================================================
// Lista de estudantes
// =============================================================================
export const STUDENTS_PAGE_SIZE = 20;

export type StudentListFilters = {
  q: string;
  role: UserRole | "all";
  subscription: "all" | "active" | "pending";
  page: number;
};

/**
 * Limpa o termo de pesquisa para o filtro .or() do PostgREST
 * (vírgulas, parênteses e asteriscos têm significado especial na sintaxe).
 */
function sanitizeSearch(q: string) {
  return q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function listStudents(filters: StudentListFilters) {
  await requireAdmin();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const from = (filters.page - 1) * STUDENTS_PAGE_SIZE;

  // "!inner" transforma o embed num JOIN, permitindo filtrar pelo estado da assinatura.
  const subsEmbed =
    filters.subscription === "all"
      ? "subscriptions!subscriptions_user_id_fkey(status, starts_at, expires_at, created_at)"
      : "subscriptions!subscriptions_user_id_fkey!inner(status, starts_at, expires_at, created_at)";

  let query = supabase
    .from("profiles")
    .select(`id, full_name, email, province, role, created_at, ${subsEmbed}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + STUDENTS_PAGE_SIZE - 1);

  if (filters.role !== "all") query = query.eq("role", filters.role);
  if (filters.subscription === "active") {
    query = query
      .eq("subscriptions.status", "active")
      .lte("subscriptions.starts_at", nowIso)
      .gt("subscriptions.expires_at", nowIso);
  } else if (filters.subscription === "pending") {
    query = query.eq("subscriptions.status", "pending");
  }

  const term = sanitizeSearch(filters.q);
  if (term) query = query.or(`full_name.ilike.*${term}*,email.ilike.*${term}*`);

  const { data, count, error } = await query;
  logError("listStudents", error);

  return {
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / STUDENTS_PAGE_SIZE)),
    rows: (data ?? []).map((p) => {
      const current = pickCurrentSubscription(p.subscriptions ?? []);
      return {
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        province: p.province,
        role: p.role,
        createdAt: p.created_at,
        subscriptionStatus: (current ? effectiveStatus(current) : "none") as SubscriptionStatus | "none",
      };
    }),
  };
}

// =============================================================================
// Ficha de um estudante
// =============================================================================
export async function getStudentDetail(userId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const [profile, subs, payments, attempts, progress] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, province, institution, academic_year, role, created_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, status, starts_at, expires_at, created_at, notes, plan:subscription_plans(name, price_mzn)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount_mzn, method, reference, status, paid_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("quiz_attempts")
      .select("id, status, percentage, passed, submitted_at, quiz:quizzes(title)")
      .eq("user_id", userId)
      .neq("status", "in_progress")
      .order("submitted_at", { ascending: false })
      .limit(20),
    supabase
      .from("student_progress")
      .select("status, last_viewed_at")
      .eq("user_id", userId)
      .order("last_viewed_at", { ascending: false }),
  ]);
  [profile, subs, payments, attempts, progress].forEach((r, i) => logError(`detail[${i}]`, r.error));

  if (!profile.data) return null;

  const completed = (progress.data ?? []).filter((p) => p.status === "completed").length;
  const attemptRows = attempts.data ?? [];

  return {
    profile: profile.data,
    subscriptions: (subs.data ?? []).map((s) => ({ ...s, effective: effectiveStatus(s) })),
    payments: payments.data ?? [],
    attempts: attemptRows,
    summary: {
      lessonsCompleted: completed,
      lastActivity: progress.data?.[0]?.last_viewed_at ?? null,
      quizzesTaken: attemptRows.length,
      averageScore: attemptRows.length
        ? Math.round(attemptRows.reduce((s, a) => s + Number(a.percentage), 0) / attemptRows.length)
        : null,
    },
  };
}
