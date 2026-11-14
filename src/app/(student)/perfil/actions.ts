"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { formatPhoneForInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";
import { profileSchema } from "@/lib/validations/profile";

/**
 * Actualiza os dados pessoais do estudante autenticado.
 * O id vem SEMPRE da sessão (nunca do formulário). A base de dados só permite
 * alterar estes campos (privilégios por coluna) e só no próprio perfil (RLS).
 */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/perfil");

  const raw = {
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    province: formData.get("province"),
    institution: formData.get("institution"),
    academicYear: formData.get("academicYear"),
  };
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v ?? "")]));

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Partial<Record<string, string[]>>,
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      province: parsed.data.province,
      institution: parsed.data.institution,
      academic_year: parsed.data.academicYear,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[perfil] update:", error.code, error.message);
    return { error: "Não foi possível guardar as alterações. Tente novamente.", values };
  }

  refresh(); // actualiza os dados mostrados no resto da aplicação
  return {
    success: "Perfil actualizado com sucesso.",
    values: { ...values, phone: formatPhoneForInput(parsed.data.phone) },
  };
}
