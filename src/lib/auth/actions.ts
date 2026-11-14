"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage } from "@/lib/auth/errors";
import { ROUTES, safeRedirectPath } from "@/lib/auth/routes";
import { publicEnv } from "@/lib/env";
import { LIMITS, RATE_LIMIT_MESSAGE, allow, clientIp } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  type FormState,
} from "@/lib/validations/auth";

/**
 * Server Actions de autenticação.
 * Correm SEMPRE no servidor: os dados do formulário são validados aqui (Zod),
 * mesmo que o browser já tenha validado.
 */

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Partial<Record<string, string[]>>;
}

function confirmUrl(next: string) {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`;
}

// -----------------------------------------------------------------------------
// Entrar
// -----------------------------------------------------------------------------
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values };
  }
  if (!allow(LIMITS.login(await clientIp(), parsed.data.email))) {
    return { error: RATE_LIMIT_MESSAGE, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: authErrorMessage(error), values };
  }

  // redirect() fica fora de try/catch (funciona lançando uma excepção especial).
  redirect(safeRedirectPath(formData.get("next")));
}

// -----------------------------------------------------------------------------
// Registar
// -----------------------------------------------------------------------------
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms") ?? undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values };
  }
  if (!allow(LIMITS.register(await clientIp()))) {
    return { error: RATE_LIMIT_MESSAGE, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Só o nome é enviado como metadado. O papel é SEMPRE "student" (trigger na BD).
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: confirmUrl(ROUTES.dashboard),
    },
  });
  if (error) {
    return { error: authErrorMessage(error), values };
  }

  // Sem confirmação de e-mail obrigatória → já tem sessão.
  if (data.session) {
    redirect(ROUTES.dashboard);
  }

  return {
    success:
      "Conta criada! Enviámos um e-mail de confirmação para " +
      parsed.data.email +
      ". Abra o link para activar a sua conta (verifique também a pasta de spam).",
  };
}

// -----------------------------------------------------------------------------
// Recuperar senha (envia o e-mail)
// -----------------------------------------------------------------------------
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values };
  }
  if (!allow(LIMITS.reset(await clientIp(), parsed.data.email))) {
    return { error: RATE_LIMIT_MESSAGE, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmUrl(ROUTES.newPassword),
  });

  if (error) {
    if (error.status === 429) return { error: authErrorMessage(error), values };
    // Outros erros: registar no servidor, mas não revelar ao utilizador.
    console.error("[auth] resetPasswordForEmail:", error.code, error.message);
  }

  // Resposta igual quer o e-mail exista ou não (evita descobrir contas).
  return {
    success:
      "Se existir uma conta com este e-mail, receberá dentro de instantes um link para redefinir a senha.",
  };
}

// -----------------------------------------------------------------------------
// Definir nova senha (após abrir o link do e-mail, já com sessão de recuperação)
// -----------------------------------------------------------------------------
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    redirect(`${ROUTES.login}?erro=sessao`);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: authErrorMessage(error) };
  }

  redirect(`${ROUTES.dashboard}?senha=alterada`);
}

// -----------------------------------------------------------------------------
// Sair
// -----------------------------------------------------------------------------
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
