"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Iniciar e submeter testes. Toda a lógica (acesso, prazo, nº de tentativas,
 * correcção e pontuação) é feita pela base de dados — o browser só envia respostas.
 */

export type StartState = { error?: string };

export async function startQuiz(_prev: StartState, formData: FormData): Promise<StartState> {
  await requireUser();
  const quizId = String(formData.get("quizId") ?? "");
  if (!z.guid().safeParse(quizId).success) return { error: "Pedido inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });
  if (error || !data) {
    console.error("[testes] start:", error?.code, error?.message);
    if (error?.code === "42501") return { error: "É necessária uma assinatura activa para fazer este teste." };
    if (error?.message?.includes("máximo de tentativas")) return { error: error.message + "." };
    return { error: "Não foi possível iniciar o teste. Tente novamente." };
  }
  redirect(`/testes/tentativas/${data.id}`);
}

const answersSchema = z.record(z.guid(), z.enum(["A", "B", "C", "D"])).refine((a) => Object.keys(a).length <= 500);

export type SubmitState = { error?: string };

export async function submitQuiz(attemptId: string, answers: Record<string, string>): Promise<SubmitState> {
  await requireUser();
  if (!z.guid().safeParse(attemptId).success) return { error: "Pedido inválido." };
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return { error: "Respostas inválidas." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_quiz_attempt", { p_attempt_id: attemptId, p_answers: parsed.data });
  if (error && !error.message.includes("já foi submetida")) {
    console.error("[testes] submit:", error.code, error.message);
    return { error: "Não foi possível submeter. Verifique a ligação e tente novamente — as suas respostas estão guardadas neste dispositivo." };
  }
  redirect(`/testes/tentativas/${attemptId}`);
}
