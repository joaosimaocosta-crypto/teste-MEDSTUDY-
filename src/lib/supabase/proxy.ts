import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  GUEST_ONLY_PREFIXES,
  PROTECTED_PREFIXES,
  ROUTES,
  matchesPrefix,
} from "@/lib/auth/routes";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Executado pelo src/proxy.ts em cada pedido de página:
 *  1. Renova o token de sessão do Supabase (se estiver a expirar) e grava os cookies.
 *  2. Verificação RÁPIDA ("optimista"): sem sessão → /entrar; com sessão → fora das páginas de login.
 *
 * ⚠️ Isto NÃO substitui as verificações no servidor (requireUser/requireAdmin + RLS).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Não colocar código entre createServerClient e getClaims (recomendação do Supabase).
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = new URL(path, request.url);
    const redirectResponse = NextResponse.redirect(url);
    // Manter os cookies de sessão renovados no redireccionamento.
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    return redirectResponse;
  };

  if (!isAuthenticated && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    return redirectTo(`${ROUTES.login}?next=${encodeURIComponent(pathname + search)}`);
  }

  if (isAuthenticated && matchesPrefix(pathname, GUEST_ONLY_PREFIXES)) {
    return redirectTo(ROUTES.dashboard);
  }

  return response;
}
