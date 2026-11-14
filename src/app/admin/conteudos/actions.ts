"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { LEVELS, adminPath, isLevel, type Level } from "@/lib/content/levels";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";
import {
  baseNodeSchema,
  courseSchema,
  createNodeSchema,
  lessonSchema,
  resourceSchema,
} from "@/lib/validations/content";

/**
 * Acções de gestão de conteúdos (todas exigem administrador).
 * Defesa em camadas: requireAdmin() aqui + políticas RLS "admin gere" na BD.
 */

const uuid = z.guid();

async function adminDb() {
  await requireAdmin();
  return (await createClient()) as unknown as SupabaseClient;
}

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Partial<Record<string, string[]>>;
}

function readLevel(formData: FormData): Level | null {
  const level = formData.get("level");
  return isLevel(level) ? level : null;
}

/** Gera um slug livre dentro do mesmo "pai" (ex.: aula-1, aula-1-2, aula-1-3…). */
async function uniqueSlug(supabase: SupabaseClient, level: Level, parentId: string | null, base: string) {
  const cfg = LEVELS[level];
  let query = supabase.from(cfg.table).select("slug").like("slug", `${base}%`);
  if (cfg.parentKey && parentId) query = query.eq(cfg.parentKey, parentId);
  const { data } = await query;
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

// -----------------------------------------------------------------------------
// Criar (como rascunho) e abrir a página de edição
// -----------------------------------------------------------------------------
export async function createNode(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminDb();
  const level = readLevel(formData);
  if (!level) return { error: "Pedido inválido." };
  const cfg = LEVELS[level];

  const parentId = cfg.parentKey ? String(formData.get("parentId") ?? "") : null;
  if (cfg.parentKey && !uuid.safeParse(parentId).success) return { error: "Pedido inválido." };

  const parsed = createNodeSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { title: String(formData.get("title") ?? "") } };

  // Próxima posição (no fim da lista)
  let posQuery = supabase.from(cfg.table).select("position").order("position", { ascending: false }).limit(1);
  if (cfg.parentKey) posQuery = posQuery.eq(cfg.parentKey, parentId);
  const { data: last } = await posQuery;
  const position = ((last?.[0] as { position: number } | undefined)?.position ?? 0) + 1;

  const slug = await uniqueSlug(supabase, level, parentId, slugify(parsed.data.title));
  const insert: Record<string, unknown> = { title: parsed.data.title, slug, position, status: "draft" };
  if (cfg.parentKey) insert[cfg.parentKey] = parentId;

  const { data, error } = await supabase.from(cfg.table).insert(insert).select("id").single();
  if (error || !data) {
    console.error("[conteudos] create:", error?.code, error?.message);
    return { error: `Não foi possível criar ${cfg.article} ${cfg.label.toLowerCase()}.` };
  }
  redirect(adminPath(level, (data as { id: string }).id));
}

// -----------------------------------------------------------------------------
// Guardar alterações
// -----------------------------------------------------------------------------
export async function updateNode(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminDb();
  const level = readLevel(formData);
  const id = String(formData.get("id") ?? "");
  if (!level || !uuid.safeParse(id).success) return { error: "Pedido inválido." };
  const cfg = LEVELS[level];

  const raw = Object.fromEntries(formData.entries());
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  const schema = level === "lesson" ? lessonSchema : level === "course" ? courseSchema : baseNodeSchema;
  const parsed = schema.safeParse({ ...raw, is_free_preview: raw.is_free_preview ?? "false" });
  if (!parsed.success) {
    return { error: "Verifique os campos assinalados.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const { error } = await supabase.from(cfg.table).update(parsed.data).eq("id", id);
  if (error) {
    console.error("[conteudos] update:", error.code, error.message);
    if (error.code === "23505") {
      return { error: "Já existe outro item com este endereço (slug) no mesmo nível.", fieldErrors: { slug: ["Endereço já usado."] }, values };
    }
    return { error: "Não foi possível guardar as alterações.", values };
  }

  refresh();
  // Devolver os valores gravados: após a submissão o React repõe os campos com os
  // valores por omissão; o formulário usa estes para não voltar aos valores ANTIGOS
  // (ex.: o estado voltava a "Rascunho" e uma 2.ª gravação despublicava a aula).
  return { success: "Alterações guardadas.", values };
}

// -----------------------------------------------------------------------------
// Mover para cima / para baixo (troca a posição com o vizinho)
// -----------------------------------------------------------------------------
export async function moveNode(formData: FormData) {
  const supabase = await adminDb();
  const level = readLevel(formData);
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!level || !uuid.safeParse(id).success) return;
  const cfg = LEVELS[level];

  const { data: current } = await supabase.from(cfg.table).select(`id, position${cfg.parentKey ? `, ${cfg.parentKey}` : ""}`).eq("id", id).maybeSingle();
  if (!current) return;
  const cur = current as unknown as Record<string, string | number>;

  let siblings = supabase.from(cfg.table).select("id, position").order("position").order("title");
  if (cfg.parentKey) siblings = siblings.eq(cfg.parentKey, cur[cfg.parentKey] as string);
  const { data: list } = await siblings;
  const items = (list ?? []) as { id: string; position: number }[];

  const index = items.findIndex((i) => i.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;

  // Normaliza as posições (1, 2, 3…) e troca as duas
  const ordered = [...items];
  [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
  await Promise.all(
    ordered
      .map((item, i) => ({ ...item, newPos: i + 1 }))
      .filter((item) => item.position !== item.newPos)
      .map((item) => supabase.from(cfg.table).update({ position: item.newPos }).eq("id", item.id)),
  );
  refresh();
}

// -----------------------------------------------------------------------------
// Eliminar (só se não tiver conteúdos dependentes)
// -----------------------------------------------------------------------------
export async function deleteNode(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminDb();
  const level = readLevel(formData);
  const id = String(formData.get("id") ?? "");
  if (!level || !uuid.safeParse(id).success) return { error: "Pedido inválido." };
  const cfg = LEVELS[level];

  // Protecção: não eliminar em cascata por engano.
  const checks: { table: string; column: string; label: string }[] = [];
  if (cfg.child) checks.push({ table: LEVELS[cfg.child].table, column: LEVELS[cfg.child].parentKey!, label: LEVELS[cfg.child].plural.toLowerCase() });
  if (level === "course") {
    checks.push({ table: "manuals", column: "course_id", label: "manuais" });
    checks.push({ table: "quizzes", column: "course_id", label: "testes" });
  }
  for (const c of checks) {
    const { count } = await supabase.from(c.table).select("id", { count: "exact", head: true }).eq(c.column, id);
    if ((count ?? 0) > 0) {
      return { error: `Não é possível eliminar: ainda contém ${count} ${c.label}. Elimine-os ou mova-os primeiro (ou arquive em vez de eliminar).` };
    }
  }

  const { data: row } = await supabase
    .from(cfg.table)
    .select(cfg.parentKey ? `id, ${cfg.parentKey}` : "id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Item não encontrado." };

  const { error } = await supabase.from(cfg.table).delete().eq("id", id);
  if (error) {
    console.error("[conteudos] delete:", error.code, error.message);
    return { error: "Não foi possível eliminar." };
  }

  const parentId = cfg.parentKey ? (row as unknown as Record<string, string>)[cfg.parentKey] : null;
  redirect(cfg.parent && parentId ? adminPath(cfg.parent, parentId) : "/admin/cursos");
}

// -----------------------------------------------------------------------------
// Recursos de uma aula
// -----------------------------------------------------------------------------
export async function createResource(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminDb();
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!uuid.safeParse(lessonId).success) return { error: "Pedido inválido." };

  const raw = { title: formData.get("title"), type: formData.get("type"), url: formData.get("url"), description: formData.get("description") };
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v ?? "")]));
  const parsed = resourceSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { data: last } = await supabase
    .from("resources")
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1);
  const position = ((last?.[0] as { position: number } | undefined)?.position ?? 0) + 1;

  const { error } = await supabase.from("resources").insert({ ...parsed.data, lesson_id: lessonId, position });
  if (error) {
    console.error("[conteudos] createResource:", error.code, error.message);
    return { error: "Não foi possível adicionar o recurso.", values };
  }
  refresh();
  return { success: "Recurso adicionado." };
}

export async function deleteResource(formData: FormData) {
  const supabase = await adminDb();
  const id = String(formData.get("id") ?? "");
  if (!uuid.safeParse(id).success) return;
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) console.error("[conteudos] deleteResource:", error.code, error.message);
  refresh();
}
