"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";
import { paymentSchema } from "@/lib/validations/subscriptions";

/**
 * Registo manual de pagamentos. Com "aplicar", a mesma transacção na BD activa o
 * pedido pendente do estudante, renova a assinatura actual ou cria uma nova.
 */
export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = paymentSchema.safeParse({ ...Object.fromEntries(formData.entries()), apply: formData.get("apply") ?? "false" });
  if (!parsed.success) {
    return {
      error: "Verifique os campos assinalados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>>,
      values,
    };
  }
  const d = parsed.data;
  const supabase = await createClient();

  // Comparação exacta (com ilike, "_" e "%" seriam caracteres universais).
  const { data: student } = await supabase.from("profiles").select("id").eq("email", d.email).maybeSingle();
  if (!student) return { error: "Não existe nenhum utilizador com este e-mail.", fieldErrors: { email: ["E-mail não encontrado."] }, values };

  // Assinatura a aplicar: pedido pendente do mesmo plano, senão a mais recente desse plano.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, status, plan_id, created_at")
    .eq("user_id", student.id)
    .eq("plan_id", d.plan_id)
    .order("created_at", { ascending: false });
  const target = subs?.find((s) => s.status === "pending") ?? subs?.find((s) => s.status !== "suspended") ?? null;

  const { error } = await supabase.rpc("admin_record_payment", {
    p_user_id: student.id,
    p_plan_id: d.plan_id,
    p_amount_mzn: d.amount_mzn,
    p_method: d.method,
    p_reference: d.reference ?? "",
    p_paid_at: d.paid_at ? `${d.paid_at}T12:00:00+02:00` : new Date().toISOString(),
    p_subscription_id: target?.id,
    p_apply: d.apply,
    p_notes: d.notes ?? "",
  });
  if (error) {
    console.error("[pagamentos] registar:", error.code, error.message);
    return { error: "Não foi possível registar o pagamento.", values };
  }
  refresh();
  return {
    success: d.apply
      ? target?.status === "pending"
        ? "Pagamento registado e pedido activado."
        : target
          ? "Pagamento registado e assinatura renovada."
          : "Pagamento registado e assinatura criada."
      : "Pagamento registado (sem alterar a assinatura).",
  };
}

/** Anular um pagamento registado por engano (não altera a assinatura). */
export async function voidPayment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("payments").update({ status: "rejected" }).eq("id", id);
  if (error) console.error("[pagamentos] anular:", error.code, error.message);
  refresh();
}
