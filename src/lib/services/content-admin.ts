import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/session";
import { LEVELS, type Level, type PublicationStatus } from "@/lib/content/levels";
import { createClient } from "@/lib/supabase/server";

/**
 * Leitura de conteúdos para a administração (genérica para os 5 níveis).
 * Usa o cliente com a sessão do administrador (RLS "admin gere" autoriza).
 *
 * Nota: como o nome da tabela é variável, usamos o cliente sem tipos gerados
 * (SupabaseClient genérico) apenas neste ficheiro e nas acções de conteúdos.
 */

export type NodeSummary = {
  id: string;
  title: string;
  slug: string;
  status: PublicationStatus;
  position: number;
};

export type Crumb = { level: Level; id: string; title: string };

async function db() {
  await requireAdmin();
  return (await createClient()) as unknown as SupabaseClient;
}

export async function listCourses() {
  const supabase = await db();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, slug, status, position, subjects(count)")
    .order("position")
    .order("title");
  if (error) console.error("[content-admin] listCourses:", error.message);
  return (data ?? []).map((c) => ({
    ...(c as NodeSummary),
    subjectCount: (c.subjects as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

/** Caminho (breadcrumbs) desde o curso até ao nó indicado. */
async function getAncestors(supabase: SupabaseClient, level: Level, row: Record<string, unknown>) {
  const crumbs: Crumb[] = [];
  let currentLevel = LEVELS[level].parent;
  let currentId = LEVELS[level].parentKey ? (row[LEVELS[level].parentKey!] as string) : null;

  while (currentLevel && currentId) {
    const cfg = LEVELS[currentLevel];
    const cols = ["id", "title", cfg.parentKey].filter(Boolean).join(", ");
    const { data } = await supabase.from(cfg.table).select(cols).eq("id", currentId).maybeSingle();
    if (!data) break;
    const r = data as unknown as Record<string, string>;
    crumbs.unshift({ level: currentLevel, id: r.id, title: r.title });
    currentId = cfg.parentKey ? r[cfg.parentKey] : null;
    currentLevel = cfg.parent;
  }
  return crumbs;
}

export async function getNodePage(level: Level, id: string) {
  const supabase = await db();
  const cfg = LEVELS[level];

  const { data: row, error } = await supabase.from(cfg.table).select("*").eq("id", id).maybeSingle();
  if (error) console.error("[content-admin] getNode:", error.message);
  if (!row) return null;

  const childCfg = cfg.child ? LEVELS[cfg.child] : null;

  const [ancestors, childrenRes, resourcesRes, manualsRes, quizzesRes] = await Promise.all([
    getAncestors(supabase, level, row),
    childCfg
      ? supabase
          .from(childCfg.table)
          .select("id, title, slug, status, position")
          .eq(childCfg.parentKey!, id)
          .order("position")
          .order("title")
      : Promise.resolve({ data: [] }),
    level === "lesson"
      ? supabase
          .from("resources")
          .select("id, title, type, url, description, position")
          .eq("lesson_id", id)
          .order("position")
      : Promise.resolve({ data: [] }),
    level === "course"
      ? supabase.from("manuals").select("id", { count: "exact", head: true }).eq("course_id", id)
      : Promise.resolve({ count: 0 }),
    level === "course"
      ? supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("course_id", id)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    row: row as Record<string, unknown> & NodeSummary,
    ancestors,
    children: (childrenRes.data ?? []) as NodeSummary[],
    resources: (resourcesRes.data ?? []) as {
      id: string;
      title: string;
      type: string;
      url: string;
      description: string | null;
      position: number;
    }[],
    blockers: {
      manuals: ("count" in manualsRes ? manualsRes.count : 0) ?? 0,
      quizzes: ("count" in quizzesRes ? quizzesRes.count : 0) ?? 0,
    },
  };
}
