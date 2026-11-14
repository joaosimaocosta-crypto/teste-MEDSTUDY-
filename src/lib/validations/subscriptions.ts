import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const money = z.preprocess(
  (v) => (typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : v),
  z.number({ message: "Valor inválido." }).min(0, { message: "O valor não pode ser negativo." }).max(1_000_000, { message: "Valor demasiado alto." }),
);

export const PAYMENT_METHODS = {
  mpesa: "M-Pesa",
  emola: "e-Mola",
  mkesh: "mKesh",
  bank_transfer: "Transferência bancária",
  cash: "Numerário",
  other: "Outro",
} as const;

/** Plano de assinatura (administração). */
export const planSchema = z.object({
  name: z.string().trim().min(2, { message: "Indique o nome do plano." }).max(100, { message: "Nome demasiado longo." }),
  description: z.preprocess(emptyToNull, z.string().trim().max(500, { message: "Descrição demasiado longa." }).nullable()),
  price_mzn: money,
  duration_days: z.preprocess(
    (v) => Number(v),
    z.number({ message: "Indique a duração." }).int().min(1, { message: "Entre 1 e 366 dias." }).max(366, { message: "Entre 1 e 366 dias." }),
  ),
  // Um benefício por linha no formulário
  features: z.preprocess(
    (v) =>
      typeof v === "string"
        ? v.split("\n").map((l) => l.trim()).filter(Boolean)
        : [],
    z.array(z.string().max(120, { message: "Cada benefício pode ter até 120 caracteres." })).max(12, { message: "Máximo 12 benefícios." }),
  ),
  course_id: z.preprocess(emptyToNull, z.guid({ message: "Curso inválido." }).nullable()),
  is_active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

/** Instruções de pagamento e contacto (definidas pelo administrador). */
export const settingsSchema = z.object({
  payment_instructions: z.preprocess(emptyToNull, z.string().trim().max(5000, { message: "Texto demasiado longo." }).nullable()),
  support_contact: z.preprocess(emptyToNull, z.string().trim().max(300, { message: "Texto demasiado longo." }).nullable()),
});

/** Pedido de plano pelo estudante. */
export const subscriptionRequestSchema = z.object({
  plan_id: z.guid({ message: "Escolha um plano." }),
  notes: z.preprocess(emptyToNull, z.string().trim().max(500, { message: "Máximo 500 caracteres." }).nullable()),
});

/** Registo manual de pagamento (administração). */
export const paymentSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Indique o e-mail do estudante." })),
  plan_id: z.guid({ message: "Escolha o plano." }),
  amount_mzn: money,
  method: z.enum(Object.keys(PAYMENT_METHODS) as [keyof typeof PAYMENT_METHODS], { message: "Escolha o método." }),
  reference: z.preprocess(emptyToNull, z.string().trim().max(100, { message: "Referência demasiado longa." }).nullable()),
  paid_at: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida." })
      .optional(),
  ),
  apply: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
});
