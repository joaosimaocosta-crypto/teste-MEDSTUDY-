import "server-only";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Testes e avaliações.
 * Estudante: nunca lê a tabela "questions" — usa funções seguras da BD
 * (quiz_catalog, get_attempt_questions, get_attempt_review).
 * Administrador: lê e gere tudo (RLS "admin gere").
 */

// =============================================================================
// Estudante
// =============================================================================
export async function listQuizCatalog() {
  await requireUser("/testes");
  const supabase = await createClient();
  const [{ data, error }, { data: history }] = await Promise.all([
    supabase.rpc("quiz_catalog"),
    supabase
      .from("quiz_attempts")
      .select("id, status, percentage, passed, submitted_at, quiz:quizzes(id, title)")
      .neq("status", "in_progress")
      .order("submitted_at", { ascending: false })
      .limit(20),
  ]);
  if (error) console.error("[testes] catálogo:", error.message);
  return { quizzes: data ?? [], history: history ?? [] };
}

export async function getQuizDetail(quizId: string) {
  await requireUser(`/testes/${quizId}`);
  const supabase = await createClient();
  const [{ data: rows }, { data: attempts }] = await Promise.all([
    supabase.rpc("quiz_catalog", { p_quiz_id: quizId }),
    supabase
      .from("quiz_attempts")
      .select("id, status, score, max_score, percentage, passed, started_at, submitted_at")
      .eq("quiz_id", quizId)
      .order("started_at", { ascending: false }),
  ]);
  const quiz = rows?.[0];
  if (!quiz) return null;
  return { quiz, attempts: (attempts ?? []).filter((a) => a.status !== "in_progress") };
}

/** Tentativa do próprio estudante (a RLS só devolve as suas). */
export async function getAttempt(attemptId: string) {
  await requireUser(`/testes/tentativas/${attemptId}`);
  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select(
      "id, quiz_id, status, started_at, expires_at, submitted_at, score, max_score, percentage, passed, quiz:quizzes(title, passing_score, time_limit_minutes, max_attempts)",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return null;

  if (attempt.status === "in_progress") {
    const { data: questions, error } = await supabase.rpc("get_attempt_questions", { p_attempt_id: attemptId });
    if (error) console.error("[testes] perguntas:", error.message);
    return { attempt, questions: questions ?? [], review: null };
  }

  const [{ data: review, error }, { data: catalog }] = await Promise.all([
    supabase.rpc("get_attempt_review", { p_attempt_id: attemptId }),
    supabase.rpc("quiz_catalog", { p_quiz_id: attempt.quiz_id }),
  ]);
  if (error) console.error("[testes] correcção:", error.message);
  const info = catalog?.[0];
  const canRetry = Boolean(info && !info.is_locked && (info.max_attempts == null || info.attempts_used < info.max_attempts));
  return { attempt, questions: null, review: review ?? [], canRetry };
}

// =============================================================================
// Administração
// =============================================================================
export async function listQuizzesForAdmin() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, status, time_limit_minutes, passing_score, course:courses(title), subject:subjects(title), questions(count), quiz_attempts(count)")
    .order("created_at", { ascending: false });
  if (error) console.error("[testes] admin list:", error.message);
  return (data ?? []).map((q) => ({
    ...q,
    questionCount: (q.questions as unknown as { count: number }[])[0]?.count ?? 0,
    attemptCount: (q.quiz_attempts as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function getQuizForAdmin(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: quiz }, { data: questions }, { data: attempts }, { data: qstats }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", id).maybeSingle(),
    supabase.from("questions").select("*").eq("quiz_id", id).order("position").order("created_at"),
    supabase.from("quiz_attempts").select("percentage, passed, status").eq("quiz_id", id).neq("status", "in_progress"),
    supabase.rpc("admin_question_stats", { p_quiz_id: id }),
  ]);
  if (!quiz) return null;
  const done = attempts ?? [];
  return {
    quiz,
    questions: questions ?? [],
    questionStats: new Map((qstats ?? []).map((q) => [q.question_id, q])),
    stats: {
      attempts: done.length,
      average: done.length ? Math.round(done.reduce((s, a) => s + Number(a.percentage), 0) / done.length) : null,
      passRate: done.length ? Math.round((done.filter((a) => a.passed).length / done.length) * 100) : null,
    },
  };
}
