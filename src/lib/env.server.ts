import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente SECRETAS — só existem no servidor.
 * O import "server-only" faz a compilação falhar se este ficheiro
 * for importado por um componente do cliente.
 */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20, { message: "SUPABASE_SECRET_KEY em falta" }),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Configuração do servidor inválida:\n" +
        parsed.error.issues.map((i) => `  - ${i.message}`).join("\n"),
    );
  }
  return parsed.data;
}
