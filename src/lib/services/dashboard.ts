import "server-only";
import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dayKey, weekdayShort } from "@/lib/format";
import type { Database } from "@/types/database";

/**
 * Dados do dashboard do estudante.
 * Todas as consultas usam o cliente com a sessão do estudante → a RLS garante
 * que só são lidos os dados dele.
 */

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export type SubscriptionSummary = {
  status: SubscriptionStatus | "none";
  planName: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
};

export type DashboardData = {
  subscription: SubscriptionSummary;
  stats: {
    lessonsCompleted: number;
    quizzesTaken: number;
    averageScore: number | null;
    studyDaysLast7: number;
  };
  weekly: { date: string; label: string; lessons: number }[];
  subjects: {
    subjectId: string;
    subjectTitle: string;
    courseTitle: string;
    total: number;
    completed: number;
    percent: number;
  }[];
  recentAttempts: {
    id: string;
    quizTitle: string;
    percentage: number;
    passed: boolean;
    status: Database["public"]["Enums"]["quiz_attempt_status"];
    submittedAt: string | null;
  }[];
  continueLesson: { id: string; title: string; lastViewedAt: string } | null;
};

const DAY_MS = 86_400_000;

export async function getDashboardData(user: CurrentUser): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();

  const [subsRes, progressRes, attemptsRes, subjectsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, starts_at, expires_at, created_at, plan:subscription_plans(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("student_progress")
      .select("status, completed_at, last_viewed_at, lesson:lessons(id, title)")
      .eq("user_id", user.id)
      .order("last_viewed_at", { ascending: false }),
    supabase
      .from("quiz_attempts")
      .select("id, status, percentage, passed, submitted_at, quiz:quizzes(title)")
      .eq("user_id", user.id)
      .neq("status", "in_progress")
      .order("submitted_at", { ascending: false }),
    supabase.rpc("student_subject_progress"),
  ]);

  for (const [name, res] of Object.entries({ subsRes, progressRes, attemptsRes, subjectsRes })) {
    if (res.error) console.error(`[dashboard] ${name}:`, res.error.message);
  }

  // --- Assinatura -------------------------------------------------------------
  const subs = subsRes.data ?? [];
  const isLive = (s: (typeof subs)[number]) =>
    s.status === "active" && s.expires_at !== null && new Date(s.expires_at) > now;
  const chosen = subs.find(isLive) ?? subs.find((s) => s.status === "pending") ?? subs[0];

  let subscription: SubscriptionSummary = { status: "none", planName: null, expiresAt: null, daysLeft: null };
  if (chosen) {
    const live = isLive(chosen);
    const status: SubscriptionStatus =
      chosen.status === "active" && !live ? "expired" : chosen.status;
    subscription = {
      status,
      planName: chosen.plan?.name ?? null,
      expiresAt: chosen.expires_at,
      daysLeft:
        live && chosen.expires_at
          ? Math.max(0, Math.ceil((new Date(chosen.expires_at).getTime() - now.getTime()) / DAY_MS))
          : null,
    };
  }

  // --- Progresso e actividade --------------------------------------------------
  const progress = progressRes.data ?? [];
  const completed = progress.filter((p) => p.status === "completed");
  const attempts = attemptsRes.data ?? [];

  // Últimos 7 dias (hoje incluído), no fuso horário de Moçambique.
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * DAY_MS));
  const weekly = days.map((d) => ({ date: dayKey(d), label: weekdayShort(d), lessons: 0 }));
  const byKey = new Map(weekly.map((w) => [w.date, w]));
  for (const p of completed) {
    if (p.completed_at) {
      const w = byKey.get(dayKey(new Date(p.completed_at)));
      if (w) w.lessons += 1;
    }
  }

  const activeDays = new Set<string>();
  const addDay = (iso: string | null) => {
    if (!iso) return;
    const key = dayKey(new Date(iso));
    if (byKey.has(key)) activeDays.add(key);
  };
  progress.forEach((p) => {
    addDay(p.last_viewed_at);
    addDay(p.completed_at);
  });
  attempts.forEach((a) => addDay(a.submitted_at));

  const averageScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + Number(a.percentage), 0) / attempts.length)
      : null;

  const lastViewed = progress.find((p) => p.lesson && p.status !== "completed") ?? progress.find((p) => p.lesson);

  return {
    subscription,
    stats: {
      lessonsCompleted: completed.length,
      quizzesTaken: attempts.length,
      averageScore,
      studyDaysLast7: activeDays.size,
    },
    weekly,
    subjects: (subjectsRes.data ?? []).map((s) => ({
      subjectId: s.subject_id,
      subjectTitle: s.subject_title,
      courseTitle: s.course_title,
      total: s.total_lessons,
      completed: s.completed_lessons,
      percent: s.total_lessons > 0 ? Math.round((s.completed_lessons / s.total_lessons) * 100) : 0,
    })),
    recentAttempts: attempts.slice(0, 5).map((a) => ({
      id: a.id,
      quizTitle: a.quiz?.title ?? "Teste",
      percentage: Math.round(Number(a.percentage)),
      passed: a.passed,
      status: a.status,
      submittedAt: a.submitted_at,
    })),
    continueLesson:
      lastViewed?.lesson
        ? { id: lastViewed.lesson.id, title: lastViewed.lesson.title, lastViewedAt: lastViewed.last_viewed_at }
        : null,
  };
}

