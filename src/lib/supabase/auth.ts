import "server-only";
import { isIP } from "node:net";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import { clientIp } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase SÓ para pedidos de autenticação sem sessão
 * (entrar, registar, pedir recuperação de senha).
 *
 * Porquê: estes pedidos partem do servidor da plataforma, por isso o Supabase Auth
 * vê sempre o MESMO IP e aplica os limites de tentativas à plataforma inteira
 * (ex.: 30 logins por 5 min para TODOS os estudantes juntos).
 *
 * Com SUPABASE_FORWARD_CLIENT_IP=true, o pedido leva o IP real do estudante no
 * cabeçalho Sb-Forwarded-For e o Supabase passa a contar os limites por estudante.
 * O cabeçalho é enviado com a chave SECRETA (só existe no servidor), para que não
 * possa ser falsificado a partir do browser.
 *
 * ⚠️ Nunca usar este cliente para consultar dados: a chave secreta ignora o RLS.
 * Depois do login, as consultas usam sempre createClient() (sessão do estudante).
 */
export async function createAuthClient() {
  const env = getServerEnv();
  if (env.SUPABASE_FORWARD_CLIENT_IP !== "true") return createClient();

  await connection();
  const ip = await clientIp();
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    // Só envia o cabeçalho se o valor for um IP válido (o Supabase rejeita valores inválidos).
    global: { headers: isIP(ip) ? { "Sb-Forwarded-For": ip } : {} },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Grava a sessão do estudante (os cookies não dependem da chave usada).
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}
