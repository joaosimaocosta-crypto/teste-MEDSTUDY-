import "server-only";
import { requireUser } from "@/lib/auth/session";
import { dayKey } from "@/lib/format";
import { buildHeatmap, computeStreaks, type ActivityDay } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

/** Página /progresso: tudo lido com a sessão do estudante (RLS). */
export async function getMyProgress() {
  await requireUser("/progresso");
  const supabase = await createClient();
  const since = dayKey(new Date(Date.now() - 400 * 86_400_000));

  const [subjectsRes, activityRes, attemptsRes] = await Promise.all([
    supabase.rpc("my_subject_progress"),
    supabase
      .from("student_activity_days")
      .select("day, lessons_viewed, lessons_completed, quizzes_submitted")
      .gte("day", since)
      .order("day"),
    supabase
      .from("quiz_attempts")
      .select("id, percentage, passed, status, submitted_at, quiz:quizzes(title)")
      .neq("status", "in_progress")
      .order("submitted_at", { ascending: true }),
  ]);
  for (const [k, r] of Object.entries({ subjectsRes, activityRes, attemptsRes })) {
    if (r.error) console.error(`[progresso] ${k}:`, r.error.message);
  }

  const subjects = subjectsRes.data ?? [];
  const activity = (activityRes.data ?? []) as ActivityDay[];
  const attempts = attemptsRes.data ?? [];

  // Agregar por curso
  const courses = new Map<string, { id: string; title: string; total: number; completed: number; subjects: typeof subjects }>();
  for (const s of subjects) {
    const c = courses.get(s.course_id) ?? { id: s.course_id, title: s.course_title, total: 0, completed: 0, subjects: [] };
    c.total += s.total_lessons;
    c.completed += s.completed_lessons;
    c.subjects.push(s);
    courses.set(s.course_id, c);
  }

  const total = subjects.reduce((n, s) => n + s.total_lessons, 0);
  const completed = subjects.reduce((n, s) => n + s.completed_lessons, 0);

  return {
    totals: {
      lessons: total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
      minutes: subjects.reduce((n, s) => n + s.completed_minutes, 0),
    },
    streaks: computeStreaks(activity),
    heatmap: buildHeatmap(activity, 12),
    courses: [...courses.values()],
    quizzes: {
      taken: attempts.length,
      passed: attempts.filter((a) => a.passed).length,
      average: attempts.length ? Math.round(attempts.reduce((n, a) => n + Number(a.percentage), 0) / attempts.length) : null,
      series: attempts.slice(-20).map((a) => ({
        key: a.id,
        label: a.submitted_at ? a.submitted_at : "",
        title: a.quiz?.title ?? "Teste",
        value: Math.round(Number(a.percentage)),
        passed: a.passed,
      })),
    },
  };
}
