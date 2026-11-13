"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";
import { questionSchema, quizSchema } from "@/lib/validations/content";

/** Gestão de testes e perguntas (só administradores; a BD aplica RLS "admin gere"). */

function errorsOf(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Partial<Record<string, string[]>>;
}
function valuesOf(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
}

// -----------------------------------------------------------------------------
// Testes
// -----------------------------------------------------------------------------
export async function saveQuiz(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isEdit = id !== "";
  if (isEdit && !z.guid().safeParse(id).success) return { error: "Pedido inválido." };

  const values = valuesOf(formData);
  const parsed = quizSchema.safeParse({ ...Object.fromEntries(formData.entries()), shuffle_questions: formData.get("shuffle_questions") ?? "false" });
  if (!parsed.success) return { error: "Verifique os campos assinalados.", fieldErrors: errorsOf(parsed.error), values };

  const supabase = await createClient();

  if (parsed.data.subject_id) {
    const { data: subject } = await supabase.from("subjects").select("course_id").eq("id", parsed.data.subject_id).maybeSingle();
    if (!subject || subject.course_id !== parsed.data.course_id) {
      return { error: "A disciplina não pertence ao curso escolhido.", fieldErrors: { subject_id: ["Disciplina inválida."] }, values };
    }
  }

  if (parsed.data.status === "published") {
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("quiz_id", id || "00000000-0000-0000-0000-000000000000");
    if (!count) {
      return { error: "Adicione pelo menos uma pergunta antes de publicar o teste.", fieldErrors: { status: ["Sem perguntas."] }, values };
    }
  }

  if (isEdit) {
    const { error } = await supabase.from("quizzes").update(parsed.data).eq("id", id);
    if (error) {
      console.error("[testes] update:", error.code, error.message);
      return { error: "Não foi possível guardar o teste.", values };
    }
    refresh();
    return { success: "Teste guardado.", values };
  }

  const { data, error } = await supabase.from("quizzes").insert({ ...parsed.data, created_by: admin.id }).select("id").single();
  if (error || !data) {
    console.error("[testes] insert:", error?.code, error?.message);
    return { error: "Não foi possível criar o teste.", values };
  }
  redirect(`/admin/testes/${data.id}?criado=1`);
}

export async function deleteQuiz(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return { error: "Pedido inválido." };
  const supabase = await createClient();

  // Proteger o histórico dos estudantes: com tentativas, só se pode arquivar.
  const { count } = await supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("quiz_id", id);
  if (count) {
    return { error: `Este teste tem ${count} tentativas de estudantes. Para não apagar o histórico, altere o estado para Arquivado.` };
  }
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  if (error) {
    console.error("[testes] delete:", error.code, error.message);
    return { error: "Não foi possível eliminar o teste." };
  }
  redirect("/admin/testes");
}

// -----------------------------------------------------------------------------
// Perguntas
// -----------------------------------------------------------------------------
export async function saveQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const quizId = String(formData.get("quizId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(quizId).success || (id && !z.guid().safeParse(id).success)) return { error: "Pedido inválido." };

  const values = valuesOf(formData);
  const parsed = questionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Verifique os campos assinalados.", fieldErrors: errorsOf(parsed.error), values };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("questions").update(parsed.data).eq("id", id).eq("quiz_id", quizId);
    if (error) {
      console.error("[testes] update question:", error.code, error.message);
      return { error: "Não foi possível guardar a pergunta.", values };
    }
    refresh();
    return { success: "Pergunta guardada.", values };
  }

  const { data: last } = await supabase
    .from("questions")
    .select("position")
    .eq("quiz_id", quizId)
    .order("position", { ascending: false })
    .limit(1);
  const position = (last?.[0]?.position ?? 0) + 1;
  const { error } = await supabase.from("questions").insert({ ...parsed.data, quiz_id: quizId, position });
  if (error) {
    console.error("[testes] insert question:", error.code, error.message);
    return { error: "Não foi possível adicionar a pergunta.", values };
  }
  refresh();
  return { success: "Pergunta adicionada." };
}

export async function deleteQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) console.error("[testes] delete question:", error.code, error.message);
  refresh();
}

export async function moveQuestion(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const quizId = String(formData.get("quizId") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  if (!z.guid().safeParse(id).success || !z.guid().safeParse(quizId).success) return;

  const supabase = await createClient();
  const { data } = await supabase.from("questions").select("id, position").eq("quiz_id", quizId).order("position").order("created_at");
  const items = data ?? [];
  const i = items.findIndex((q) => q.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  await Promise.all(
    items
      .map((q, k) => ({ ...q, newPos: k + 1 }))
      .filter((q) => q.position !== q.newPos)
      .map((q) => supabase.from("questions").update({ position: q.newPos }).eq("id", q.id)),
  );
  refresh();
}
