import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Lê a sessão dos cookies do pedido → as consultas correm COM as permissões
 * do utilizador autenticado (RLS aplica-se).
 *
 * Criar um cliente novo em cada pedido (nunca guardar numa variável global).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component (não pode escrever cookies).
            // Seguro de ignorar: o proxy.ts (Fase 3) renova a sessão.
          }
        },
      },
    },
  );
}
