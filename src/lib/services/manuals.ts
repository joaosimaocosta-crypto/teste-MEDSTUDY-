import "server-only";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Manuais em PDF.
 * A coluna pdf_url NUNCA é lida directamente (a BD não o permite a ninguém via API);
 * o endereço só é obtido por get_manual_pdf_url() — na rota /api/manuals/[id] ou,
 * para administradores, no formulário de edição.
 */

const LIST_COLUMNS =
  "id, title, description, page_count, published_at, status, course_id, subject_id, course:courses(title, slug), subject:subjects(title)";

export type ManualFilters = { q: string; course: string | null; subject: string | null };

function sanitize(q: string) {
  return q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

// -----------------------------------------------------------------------------
// Estudante
// -----------------------------------------------------------------------------
export async function listManualsForStudent(filters: ManualFilters) {
  await requireUser("/manuais");
  const supabase = await createClient();

  let query = supabase
    .from("manuals")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .order("position")
    .order("title");
  if (filters.course) query = query.eq("course_id", filters.course);
  if (filters.subject) query = query.eq("subject_id", filters.subject);
  const term = sanitize(filters.q);
  if (term) query = query.or(`title.ilike.*${term}*,description.ilike.*${term}*`);

  const [{ data, error }, { data: courses }, { data: subjects }] = await Promise.all([
    query,
    supabase.from("courses").select("id, title").eq("status", "published").order("position"),
    supabase.from("subjects").select("id, title, course_id").eq("status", "published").order("position"),
  ]);
  if (error) console.error("[manuais] list:", error.message);

  // Acesso por curso (assinatura activa do plano global ou do curso)
  const courseIds = [...new Set((data ?? []).map((m) => m.course_id))];
  const access = new Map<string, boolean>();
  await Promise.all(
    courseIds.map(async (id) => {
      const { data: ok } = await supabase.rpc("has_course_access", { p_course_id: id });
      access.set(id, Boolean(ok));
    }),
  );

  return {
    manuals: (data ?? []).map((m) => ({ ...m, isLocked: !access.get(m.course_id) })),
    courses: courses ?? [],
    subjects: subjects ?? [],
  };
}

export async function getManualForStudent(id: string) {
  await requireUser(`/manuais/${id}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("manuals")
    .select(LIST_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  const { data: ok } = await supabase.rpc("has_course_access", { p_course_id: data.course_id });
  return { ...data, isLocked: !ok };
}

// -----------------------------------------------------------------------------
// Administração
// -----------------------------------------------------------------------------
export async function listManualsForAdmin(filters: ManualFilters & { status: string | null }) {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase.from("manuals").select(LIST_COLUMNS).order("created_at", { ascending: false });
  if (filters.course) query = query.eq("course_id", filters.course);
  if (filters.status === "draft" || filters.status === "published" || filters.status === "archived") {
    query = query.eq("status", filters.status);
  }
  const term = sanitize(filters.q);
  if (term) query = query.ilike("title", `%${term}%`);
  const { data, error } = await query;
  if (error) console.error("[manuais] admin list:", error.message);
  return data ?? [];
}

/** Cursos e disciplinas (todos os estados) para os selectores do formulário. */
export async function getCourseOptions() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: courses }, { data: subjects }] = await Promise.all([
    supabase.from("courses").select("id, title, status").order("position").order("title"),
    supabase.from("subjects").select("id, title, course_id").order("position").order("title"),
  ]);
  return { courses: courses ?? [], subjects: subjects ?? [] };
}

export async function getManualForAdmin(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: manual }, { data: pdfUrl }] = await Promise.all([
    supabase.from("manuals").select(LIST_COLUMNS).eq("id", id).maybeSingle(),
    supabase.rpc("get_manual_pdf_url", { p_manual_id: id }),
  ]);
  if (!manual) return null;
  return { ...manual, pdf_url: pdfUrl ?? "" };
}
