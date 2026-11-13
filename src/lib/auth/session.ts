import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ROUTES } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Camada de acesso à sessão (DAL — Data Access Layer).
 *
 * TODAS as verificações de autenticação/permissão no servidor passam por aqui.
 * O proxy.ts só faz uma verificação rápida; a decisão final é sempre tomada
 * nestas funções, perto dos dados.
 *
 * `cache()` do React evita repetir a mesma consulta várias vezes no mesmo pedido.
 */

export type UserRole = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole;
};

/** Utilizador autenticado (JWT validado) ou null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  // getClaims() valida a assinatura do token — nunca confiar em getSession() no servidor.
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("[auth] Perfil não encontrado para o utilizador", userId, profileError?.message);
    return null;
  }

  return {
    id: userId,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
});

/** Exige sessão; caso contrário redirecciona para o login. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const query = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`${ROUTES.login}${query}`);
  }
  return user;
}

/** Exige papel de administrador; estudantes são enviados para o painel. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser(ROUTES.admin);
  if (user.role !== "admin") {
    redirect(ROUTES.dashboard);
  }
  return user;
}
