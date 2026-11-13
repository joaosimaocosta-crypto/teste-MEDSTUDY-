/**
 * Rotas e redireccionamentos de autenticação — partilhado pelo proxy e pelas páginas.
 * (Sem "server-only": também é usado no proxy.ts.)
 */

export const ROUTES = {
  home: "/",
  login: "/entrar",
  register: "/registar",
  forgotPassword: "/recuperar-senha",
  newPassword: "/nova-senha",
  dashboard: "/painel",
  courses: "/cursos",
  manuals: "/manuais",
  quizzes: "/testes",
  progress: "/progresso",
  subscription: "/assinatura",
  profile: "/perfil",
  admin: "/admin",
} as const;

/** Rotas que exigem sessão iniciada (o prefixo cobre as sub-rotas). */
export const PROTECTED_PREFIXES = [
  "/painel",
  "/perfil",
  "/cursos",
  "/manuais",
  "/testes",
  "/progresso",
  "/assinatura",
  "/admin",
  "/nova-senha",
] as const;

/** Rotas só para visitantes: quem já tem sessão é enviado para o painel. */
export const GUEST_ONLY_PREFIXES = ["/entrar", "/registar", "/recuperar-senha"] as const;

export function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Valida o destino de um redireccionamento (?next=...).
 * Só aceita caminhos internos — evita "open redirect" para sites externos
 * (ex.: next=//site-malicioso.com ou next=https://...).
 */
export function safeRedirectPath(next: unknown, fallback: string = ROUTES.dashboard): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  return next;
}
