"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";
import { subscriptionRequestSchema } from "@/lib/validations/subscriptions";

/**
 * O estudante só pode PEDIR um plano (fica "pendente") ou cancelar o pedido.
 * A activação é feita pelo administrador após confirmar o pagamento.
 * (Políticas RLS: status = 'pending', sem datas, plano activo, um pendente por estudante.)
 */
export async function requestSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/assinatura");
  const parsed = subscriptionRequestSchema.safeParse({ plan_id: formData.get("plan_id"), notes: formData.get("notes") });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>> };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").insert({ user_id: user.id, ...parsed.data });
  if (error) {
    console.error("[assinatura] pedido:", error.code, error.message);
    if (error.code === "23505") return { error: "Já tem um pedido pendente. Aguarde a activação ou cancele-o." };
    return { error: "Não foi possível enviar o pedido. Tente novamente." };
  }
  refresh();
  return { success: "Pedido enviado! Efectue o pagamento e aguarde a activação." };
}

export async function cancelRequest(formData: FormData) {
  const user = await requireUser("/assinatura");
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return;
  const supabase = await createClient();
  // RLS: só apaga pedidos próprios e pendentes.
  const { error } = await supabase.from("subscriptions").delete().eq("id", id).eq("user_id", user.id).eq("status", "pending");
  if (error) console.error("[assinatura] cancelar:", error.code, error.message);
  refresh();
}
