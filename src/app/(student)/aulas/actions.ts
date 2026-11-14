"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Progresso das aulas. As funções da BD verificam que o estudante tem acesso
 * à aula (assinatura activa ou aula gratuita) — o browser não decide nada.
 */

const lessonId = z.guid();

/** Chamado quando o estudante abre a aula. */
export async function markLessonViewed(id: string) {
  await requireUser();
  if (!lessonId.safeParse(id).success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("touch_lesson", { p_lesson_id: id });
  if (error && error.code !== "42501") console.error("[aulas] touch:", error.code, error.message);
}

export type CompleteState = { completed: boolean; error?: string };

/** Marca ou desmarca a aula como concluída. */
export async function toggleLessonCompleted(prev: CompleteState, formData: FormData): Promise<CompleteState> {
  await requireUser();
  const id = String(formData.get("lessonId") ?? "");
  const completed = formData.get("completed") === "true";
  if (!lessonId.safeParse(id).success) return { ...prev, error: "Pedido inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lesson_completed", { p_lesson_id: id, p_completed: completed });
  if (error) {
    console.error("[aulas] complete:", error.code, error.message);
    return {
      ...prev,
      error: error.code === "42501" ? "Não tem acesso a esta aula." : "Não foi possível guardar. Tente novamente.",
    };
  }
  refresh();
  return { completed };
}
