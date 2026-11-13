"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validations/auth";

const roleSchema = z.object({
  userId: z.uuid({ message: "Utilizador inválido." }),
  role: z.enum(["student", "admin"], { message: "Papel inválido." }),
});

/**
 * Altera o papel de um utilizador (estudante ↔ administrador).
 * Três camadas: requireAdmin() aqui + a função set_user_role() na BD verifica
 * novamente is_admin() e impede um administrador de retirar o próprio acesso.
 */
export async function changeUserRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = roleSchema.safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) return { error: "Pedido inválido." };

  if (parsed.data.userId === admin.id) {
    return { error: "Não pode alterar o seu próprio papel." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) {
    console.error("[admin] set_user_role:", error.code, error.message);
    return { error: "Não foi possível alterar o papel. Tente novamente." };
  }

  refresh();
  return {
    success:
      parsed.data.role === "admin"
        ? "Utilizador promovido a administrador."
        : "Acesso de administrador removido.",
  };
}
