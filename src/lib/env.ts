import { z } from "zod";

/**
 * Variáveis de ambiente PÚBLICAS (podem chegar ao browser).
 * Cada variável NEXT_PUBLIC_* tem de ser lida explicitamente (process.env.NOME)
 * para o Next.js a incluir no código do cliente.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL tem de ser um URL válido" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, { message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em falta" }),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

if (!parsed.success) {
  throw new Error(
    "Configuração inválida. Verifique o ficheiro .env.local:\n" +
      parsed.error.issues.map((i) => `  - ${i.message}`).join("\n"),
  );
}

export const publicEnv = parsed.data;
