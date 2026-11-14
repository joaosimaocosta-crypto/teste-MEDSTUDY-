"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";

/**
 * Acções sobre assinaturas. As datas e regras são calculadas pela base de dados
 * (funções admin_* que voltam a verificar is_admin()).
 */
const OPS = {
  activate: { fn: "admin_activate_subscription", done: "Assinatura activada." },
  renew: { fn: "admin_renew_subscription", done: "Assinatura renovada." },
  suspend: { fn: "admin_suspend_subscription", done: "Assinatura suspensa." },
  reactivate: { fn: "admin_reactivate_subscription", done: "Suspensão levantada." },
} as const;

export async function subscriptionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const op = String(formData.get("op") ?? "") as keyof typeof OPS;
  if (!z.guid().safeParse(id).success || !(op in OPS)) return { error: "Pedido inválido." };

  const supabase = await createClient();
  const reason = String(formData.get("reason") ?? "").slice(0, 300);
  const { error } =
    op === "suspend"
      ? await supabase.rpc("admin_suspend_subscription", { p_subscription_id: id, p_reason: reason })
      : await supabase.rpc(OPS[op].fn as "admin_renew_subscription", { p_subscription_id: id });
  if (error) {
    console.error(`[assinaturas] ${op}:`, error.code, error.message);
    return { error: error.code === "P0001" ? error.message + "." : "Não foi possível concluir a operação." };
  }
  refresh();
  return { success: OPS[op].done };
}

export async function assignSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({ user_id: z.guid(), plan_id: z.guid({ message: "Escolha o plano." }) })
    .safeParse({ user_id: formData.get("user_id"), plan_id: formData.get("plan_id") });
  if (!parsed.success) return { error: "Escolha o plano." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_subscription", {
    p_user_id: parsed.data.user_id,
    p_plan_id: parsed.data.plan_id,
    p_activate: true,
  });
  if (error) {
    console.error("[assinaturas] atribuir:", error.code, error.message);
    return { error: "Não foi possível atribuir o plano." };
  }
  refresh();
  return { success: "Plano atribuído e activado." };
}
