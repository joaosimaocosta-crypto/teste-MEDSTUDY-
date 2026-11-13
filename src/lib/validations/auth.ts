import { z } from "zod";

/** Regras de validação dos formulários de autenticação (usadas no servidor). */

const email = z
  .string({ message: "Indique o seu e-mail." })
  .trim()
  .toLowerCase()
  .min(1, { message: "Indique o seu e-mail." })
  .max(254, { message: "E-mail demasiado longo." })
  .pipe(z.email({ message: "E-mail inválido." }));

// Igual à política configurada no Supabase (8+ caracteres, letras e números).
const newPassword = z
  .string({ message: "Indique uma senha." })
  .min(8, { message: "A senha deve ter pelo menos 8 caracteres." })
  .max(72, { message: "A senha deve ter no máximo 72 caracteres." })
  .regex(/[A-Za-z]/, { message: "A senha deve conter pelo menos uma letra." })
  .regex(/[0-9]/, { message: "A senha deve conter pelo menos um número." });

/**
 * Comparação das duas senhas. Por omissão, o Zod só corre esta regra quando TODOS
 * os campos são válidos; com `when`, corre sempre que as duas senhas foram enviadas
 * (assim o estudante vê "As senhas não coincidem" mesmo com outros erros).
 */
const passwordsMatchOptions = {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
  when(payload: z.core.ParsePayload) {
    const v = payload.value as { password?: unknown; confirmPassword?: unknown };
    return typeof v?.password === "string" && typeof v?.confirmPassword === "string";
  },
};

export const loginSchema = z.object({
  email,
  password: z
    .string({ message: "Indique a sua senha." })
    .min(1, { message: "Indique a sua senha." })
    .max(72, { message: "Senha inválida." }),
});

export const registerSchema = z
  .object({
    fullName: z
      .string({ message: "Indique o seu nome completo." })
      .trim()
      .min(3, { message: "Indique o seu nome completo." })
      .max(120, { message: "Nome demasiado longo." }),
    email,
    password: newPassword,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", { message: "Tem de aceitar os termos de utilização." }),
  })
  .refine((d) => d.password === d.confirmPassword, passwordsMatchOptions);

export const forgotPasswordSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, passwordsMatchOptions);

/** Estado devolvido pelas Server Actions aos formulários. */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Valores não sensíveis para repor no formulário (nunca senhas). */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};
