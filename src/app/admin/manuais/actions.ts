"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";
import { manualSchema } from "@/lib/validations/content";

/**
 * Criar / editar / eliminar manuais (só administradores).
 * O PDF não é carregado aqui: guarda-se o endereço do ficheiro na Lunes Host.
 */

export async function saveManual(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isEdit = id !== "";
  if (isEdit && !z.guid().safeParse(id).success) return { error: "Pedido inválido." };

  const raw = Object.fromEntries(formData.entries());
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  const parsed = manualSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Verifique os campos assinalados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>>,
      values,
    };
  }

  const supabase = await createClient();

  // A disciplina tem de pertencer ao curso escolhido (nunca confiar no formulário).
  if (parsed.data.subject_id) {
    const { data: subject } = await supabase
      .from("subjects")
      .select("course_id")
      .eq("id", parsed.data.subject_id)
      .maybeSingle();
    if (!subject || subject.course_id !== parsed.data.course_id) {
      return { error: "A disciplina não pertence ao curso escolhido.", fieldErrors: { subject_id: ["Disciplina inválida."] }, values };
    }
  }

  if (isEdit) {
    const { error } = await supabase.from("manuals").update(parsed.data).eq("id", id);
    if (error) {
      console.error("[manuais] update:", error.code, error.message);
      return { error: "Não foi possível guardar o manual.", values };
    }
    refresh();
    return { success: "Manual guardado.", values };
  }

  const { data, error } = await supabase
    .from("manuals")
    .insert({ ...parsed.data, created_by: admin.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[manuais] insert:", error?.code, error?.message);
    return { error: "Não foi possível criar o manual.", values };
  }
  redirect(`/admin/manuais/${data.id}?criado=1`);
}

export async function deleteManual(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return { error: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("manuals").delete().eq("id", id);
  if (error) {
    console.error("[manuais] delete:", error.code, error.message);
    return { error: "Não foi possível eliminar o manual." };
  }
  redirect("/admin/manuais");
}
