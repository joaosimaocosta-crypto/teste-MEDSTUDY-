import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente com a chave SECRETA — IGNORA as políticas RLS.
 *
 * ⚠️ Usar apenas no servidor, e só DEPOIS de verificar que o utilizador
 * actual é administrador (ex.: criar contas, tarefas de manutenção).
 * Nunca usar para responder directamente a pedidos de estudantes.
 */
export function createAdminClient() {
  const { SUPABASE_SECRET_KEY } = getServerEnv();

  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
