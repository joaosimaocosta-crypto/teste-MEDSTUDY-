import "server-only";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Catálogo de conteúdos para o estudante.
 * - Estrutura publicada (cursos, disciplinas): lida com a sessão do estudante (RLS).
 * - Índices com cadeados e progresso: funções seguras da BD (subject_outline, …).
 * - Conteúdo da aula: só é devolvido pela RLS se o estudante tiver acesso.
 */

type SubjectProgressRow = {
  course_id: string;
  subject_id: string;
  total_lessons: number;
  completed_lessons: number;
};

function percent(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

async function progressRows(): Promise<SubjectProgressRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_subject_progress");
  if (error) console.error("[catalog] progress:", error.message);
  return data ?? [];
}

// -----------------------------------------------------------------------------
export async function listCatalog() {
  await requireUser("/cursos");
  const supabase = await createClient();
  const [{ data: courses, error }, progress, access] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug, description, cover_image_url, subjects(count)")
      .eq("status", "published")
      .order("position")
      .order("title"),
    progressRows(),
    supabase.rpc("has_active_subscription"),
  ]);
  if (error) console.error("[catalog] courses:", error.message);

  return {
    hasSubscription: Boolean(access.data),
    courses: (courses ?? []).map((c) => {
      const rows = progress.filter((p) => p.course_id === c.id);
      const total = rows.reduce((s, r) => s + r.total_lessons, 0);
      const done = rows.reduce((s, r) => s + r.completed_lessons, 0);
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        coverImageUrl: c.cover_image_url,
        subjectCount: (c.subjects as unknown as { count: number }[])[0]?.count ?? 0,
        totalLessons: total,
        completedLessons: done,
        percent: percent(done, total),
      };
    }),
  };
}

// -----------------------------------------------------------------------------
export async function getCourse(courseSlug: string) {
  await requireUser(`/cursos/${courseSlug}`);
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, description")
    .eq("slug", courseSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!course) return null;

  const [{ data: subjects }, progress] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, title, slug, description")
      .eq("course_id", course.id)
      .eq("status", "published")
      .order("position")
      .order("title"),
    progressRows(),
  ]);

  return {
    course,
    subjects: (subjects ?? []).map((s) => {
      const p = progress.find((r) => r.subject_id === s.id);
      const total = p?.total_lessons ?? 0;
      const done = p?.completed_lessons ?? 0;
      return { ...s, totalLessons: total, completedLessons: done, percent: percent(done, total) };
    }),
  };
}

// -----------------------------------------------------------------------------
export type OutlineLesson = {
  id: string;
  title: string;
  summary: string | null;
  durationMinutes: number | null;
  isFreePreview: boolean;
  isLocked: boolean;
  isCompleted: boolean;
};
export type OutlineChapter = { id: string; title: string; lessons: OutlineLesson[] };
export type OutlineModule = { id: string; title: string; chapters: OutlineChapter[] };

export async function getSubject(courseSlug: string, subjectSlug: string) {
  await requireUser(`/cursos/${courseSlug}/${subjectSlug}`);
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("slug", courseSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!course) return null;

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, title, slug, description")
    .eq("course_id", course.id)
    .eq("slug", subjectSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!subject) return null;

  const { data: rows, error } = await supabase.rpc("subject_outline", { p_subject_id: subject.id });
  if (error) console.error("[catalog] outline:", error.message);

  // Agrupar as linhas (já ordenadas) em módulos → capítulos → aulas
  const modules: OutlineModule[] = [];
  for (const r of rows ?? []) {
    let mod = modules.find((m) => m.id === r.module_id);
    if (!mod) modules.push((mod = { id: r.module_id, title: r.module_title, chapters: [] }));
    let ch = mod.chapters.find((c) => c.id === r.chapter_id);
    if (!ch) mod.chapters.push((ch = { id: r.chapter_id, title: r.chapter_title, lessons: [] }));
    ch.lessons.push({
      id: r.lesson_id,
      title: r.lesson_title,
      summary: r.lesson_summary,
      durationMinutes: r.duration_minutes,
      isFreePreview: r.is_free_preview,
      isLocked: r.is_locked,
      isCompleted: r.is_completed,
    });
  }

  const all = modules.flatMap((m) => m.chapters.flatMap((c) => c.lessons));
  const done = all.filter((l) => l.isCompleted).length;
  const nextLesson = all.find((l) => !l.isCompleted && !l.isLocked) ?? null;

  return {
    course,
    subject,
    modules,
    totals: { lessons: all.length, completed: done, percent: percent(done, all.length) },
    nextLessonId: nextLesson?.id ?? null,
    hasLocked: all.some((l) => l.isLocked),
  };
}

// -----------------------------------------------------------------------------
export async function getLesson(lessonId: string) {
  await requireUser(`/aulas/${lessonId}`);
  const supabase = await createClient();
  const { data: ctxRows, error } = await supabase.rpc("get_lesson_context", { p_lesson_id: lessonId });
  if (error) console.error("[catalog] lesson context:", error.message);
  const ctx = ctxRows?.[0];
  if (!ctx) return null;

  if (ctx.is_locked) return { ctx, lesson: null, resources: [] };

  // A RLS só devolve o conteúdo se o estudante tiver acesso (verificação no servidor da BD).
  const [{ data: lesson }, { data: resources }] = await Promise.all([
    supabase.from("lessons").select("content, video_url").eq("id", lessonId).maybeSingle(),
    supabase
      .from("resources")
      .select("id, title, type, url, description")
      .eq("lesson_id", lessonId)
      .order("position"),
  ]);

  return { ctx, lesson, resources: resources ?? [] };
}
