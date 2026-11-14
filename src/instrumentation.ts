/**
 * Corre UMA vez quando o servidor arranca (convenção do Next.js).
 * Em produção, avisa nos registos (logs) da Vercel sobre configurações em falta
 * ou perigosas — não bloqueia o arranque e nunca imprime valores secretos.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const warn = (msg: string) => console.warn(`[configuração] ${msg}`);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const isLocal = (u: string) => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(u);

  if (!site || isLocal(site)) {
    warn("NEXT_PUBLIC_SITE_URL não está definido com o domínio público (links dos e-mails ficarão errados).");
  } else if (!site.startsWith("https://")) {
    warn("NEXT_PUBLIC_SITE_URL não usa https:// (HSTS e cookies seguros ficam desligados).");
  }
  if (isLocal(supabaseUrl) && site && !isLocal(site)) {
    warn("NEXT_PUBLIC_SUPABASE_URL aponta para o Supabase LOCAL num servidor público.");
  }
  if (!process.env.SUPABASE_SECRET_KEY) {
    warn("SUPABASE_SECRET_KEY em falta (funções de administração e manuais falharão).");
  }
  if (!process.env.MANUALS_ALLOWED_HOSTS) {
    warn("MANUALS_ALLOWED_HOSTS vazio: recomenda-se limitar os PDFs ao domínio da Lunes Host.");
  }
  if (process.env.SUPABASE_FORWARD_CLIENT_IP !== "true") {
    warn(
      "SUPABASE_FORWARD_CLIENT_IP desligado: os limites de login do Supabase são partilhados por todos os estudantes (ver docs/PUBLICACAO.md).",
    );
  }
}
