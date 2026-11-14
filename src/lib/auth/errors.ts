/**
 * Traduz erros do Supabase Auth para mensagens em português.
 * Mensagens genéricas de propósito: não revelamos se um e-mail existe.
 */
type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

export function authErrorMessage(error: AuthErrorLike): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "E-mail ou senha incorrectos.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Ainda não confirmou o seu e-mail. Verifique a sua caixa de entrada (e a pasta de spam).";
  }
  if (code === "weak_password" || message.includes("password should")) {
    return "A senha é demasiado fraca. Use pelo menos 8 caracteres, com letras e números.";
  }
  if (code === "same_password") {
    return "A nova senha tem de ser diferente da anterior.";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error?.status === 429
  ) {
    return "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (code === "signup_disabled") {
    return "Os registos estão temporariamente desactivados.";
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return "Não foi possível concluir o registo com estes dados.";
  }
  if (code === "session_not_found" || code === "refresh_token_not_found") {
    return "A sua sessão expirou. Entre novamente.";
  }
  return "Ocorreu um erro inesperado. Tente novamente.";
}
