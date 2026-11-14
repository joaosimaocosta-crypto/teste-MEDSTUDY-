"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";
import { planSchema, settingsSchema } from "@/lib/validations/subscriptions";

export async function savePlan(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id && !z.guid().safeParse(id).success) return { error: "Pedido inválido." };
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = planSchema.safeParse({ ...Object.fromEntries(formData.entries()), is_active: formData.get("is_active") ?? "false" });
  if (!parsed.success) {
    return { error: "Verifique os campos assinalados.", fieldErrors: z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>>, values };
  }

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("subscription_plans").update(parsed.data).eq("id", id);
    if (error) {
      console.error("[planos] update:", error.code, error.message);
      return { error: "Não foi possível guardar o plano.", values };
    }
    refresh();
    return { success: "Plano guardado.", values };
  }

  const { data: last } = await supabase.from("subscription_plans").select("position").order("position", { ascending: false }).limit(1);
  const base = slugify(parsed.data.name);
  const { data: same } = await supabase.from("subscription_plans").select("slug").like("slug", `${base}%`);
  const taken = new Set((same ?? []).map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const { error } = await supabase
    .from("subscription_plans")
    .insert({ ...parsed.data, slug, position: (last?.[0]?.position ?? 0) + 1 });
  if (error) {
    console.error("[planos] insert:", error.code, error.message);
    return { error: "Não foi possível criar o plano.", values };
  }
  refresh();
  return { success: "Plano criado." };
}

export async function deletePlan(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return { error: "Pedido inválido." };
  const supabase = await createClient();
  const { count } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", id);
  if (count) return { error: `Este plano tem ${count} assinaturas. Desactive-o em vez de eliminar (deixa de aparecer aos estudantes).` };
  const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
  if (error) {
    console.error("[planos] delete:", error.code, error.message);
    return { error: "Não foi possível eliminar o plano." };
  }
  refresh();
  return { success: "Plano eliminado." };
}

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>>, values };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update({ ...parsed.data, updated_by: admin.id }).eq("id", true);
  if (error) {
    console.error("[definicoes] update:", error.code, error.message);
    return { error: "Não foi possível guardar.", values };
  }
  refresh();
  return { success: "Instruções guardadas.", values };
}
