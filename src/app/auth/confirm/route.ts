import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTES, safeRedirectPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * GET /auth/confirm — destino dos links enviados por e-mail.
 *
 * Suporta os dois formatos do Supabase:
 *   ?token_hash=...&type=email|recovery   (modelos de e-mail do projecto — recomendado)
 *   ?code=...                             (fluxo PKCE por omissão)
 * Em caso de sucesso, a sessão fica guardada em cookies e o utilizador segue para `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const fallback = type === "recovery" ? ROUTES.newPassword : ROUTES.dashboard;
  const next = safeRedirectPath(searchParams.get("next"), fallback);

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
    if (error) console.error("[auth/confirm] verifyOtp:", error.code, error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error("[auth/confirm] exchangeCode:", error.code, error.message);
  }

  const destination = ok ? next : `${ROUTES.login}?erro=link-invalido`;
  return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
}
