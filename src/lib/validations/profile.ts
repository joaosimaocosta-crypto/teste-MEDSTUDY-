import { z } from "zod";

/** As 11 províncias de Moçambique (Maputo Cidade tem estatuto de província). */
export const PROVINCES = [
  "Cabo Delgado",
  "Gaza",
  "Inhambane",
  "Manica",
  "Maputo Cidade",
  "Maputo Província",
  "Nampula",
  "Niassa",
  "Sofala",
  "Tete",
  "Zambézia",
] as const;

export const ACADEMIC_YEARS = [1, 2, 3] as const;

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/**
 * Telefone moçambicano: aceita "84 123 4567", "+258 84 123 4567", "258841234567".
 * Guardado normalizado como "+258841234567".
 */
const phone = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[\s-]/g, "") : v),
  z
    .string()
    .regex(/^(\+?258)?8[2-7]\d{7}$/, {
      message: "Número inválido. Use o formato 84 123 4567.",
    })
    .transform((v) => `+258${v.slice(-9)}`)
    .nullable(),
);

export const profileSchema = z.object({
  fullName: z
    .string({ message: "Indique o seu nome completo." })
    .trim()
    .min(3, { message: "Indique o seu nome completo." })
    .max(120, { message: "Nome demasiado longo." }),
  phone: z.preprocess(emptyToNull, phone),
  province: z.preprocess(
    emptyToNull,
    z.enum(PROVINCES, { message: "Seleccione uma província válida." }).nullable(),
  ),
  institution: z.preprocess(
    emptyToNull,
    z.string().trim().max(150, { message: "Nome da instituição demasiado longo." }).nullable(),
  ),
  academicYear: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number()
      .int()
      .refine((n) => (ACADEMIC_YEARS as readonly number[]).includes(n), { message: "Ano inválido." })
      .nullable(),
  ),
});

export type ProfileInput = z.infer<typeof profileSchema>;
