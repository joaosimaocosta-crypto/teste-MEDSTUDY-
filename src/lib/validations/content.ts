import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";

/** Validação dos formulários de conteúdos (administração). */

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const title = z
  .string({ message: "Indique o título." })
  .trim()
  .min(2, { message: "O título deve ter pelo menos 2 caracteres." })
  .max(200, { message: "Título demasiado longo." });

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(80, { message: "Endereço demasiado longo." })
  .regex(SLUG_PATTERN, { message: "Use apenas letras minúsculas, números e hífens (ex.: anatomia-geral)." });

const status = z.enum(["draft", "published", "archived"], { message: "Estado inválido." });

const description = z.preprocess(
  emptyToNull,
  z.string().trim().max(2000, { message: "Descrição demasiado longa (máx. 2000 caracteres)." }).nullable(),
);

/** Só endereços https:// (evita conteúdo inseguro ou "javascript:"). */
export const httpsUrl = z
  .string()
  .trim()
  .max(2000, { message: "Endereço demasiado longo." })
  .pipe(z.url({ message: "Endereço inválido." }))
  .refine((u) => u.startsWith("https://"), { message: "O endereço tem de começar por https://" });

const optionalHttpsUrl = z.preprocess(emptyToNull, httpsUrl.nullable());

export const createNodeSchema = z.object({ title });

export const baseNodeSchema = z.object({ title, slug, description, status });

export const courseSchema = baseNodeSchema.extend({ cover_image_url: optionalHttpsUrl });

export const lessonSchema = z.object({
  title,
  slug,
  status,
  summary: z.preprocess(
    emptyToNull,
    z.string().trim().max(500, { message: "Resumo demasiado longo (máx. 500 caracteres)." }).nullable(),
  ),
  content: z.preprocess(
    emptyToNull,
    z.string().max(100_000, { message: "Conteúdo demasiado longo." }).nullable(),
  ),
  video_url: optionalHttpsUrl,
  duration_minutes: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number({ message: "Duração inválida." })
      .int({ message: "Use minutos inteiros." })
      .min(0)
      .max(600, { message: "Máximo 600 minutos." })
      .nullable(),
  ),
  is_free_preview: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const RESOURCE_TYPES = {
  pdf: "PDF",
  video: "Vídeo",
  link: "Link",
  document: "Documento",
  image: "Imagem",
  other: "Outro",
} as const;

export const resourceSchema = z.object({
  title,
  type: z.enum(Object.keys(RESOURCE_TYPES) as [keyof typeof RESOURCE_TYPES], { message: "Tipo inválido." }),
  url: httpsUrl,
  description: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
});

const optionalGuid = z.preprocess(emptyToNull, z.guid({ message: "Selecção inválida." }).nullable());

/** Manual em PDF (o ficheiro fica na Lunes Host; aqui guarda-se o endereço). */
export const manualSchema = z.object({
  title,
  description,
  status,
  course_id: z.guid({ message: "Seleccione o curso." }),
  subject_id: optionalGuid,
  pdf_url: httpsUrl.refine((u) => !/\s/.test(u), { message: "O endereço não pode ter espaços." }),
  page_count: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number({ message: "Número inválido." }).int().min(1).max(10_000).nullable(),
  ),
});

const optionalInt = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number({ message: msg }).int({ message: msg }).min(min, { message: msg }).max(max, { message: msg }).nullable(),
  );

/** Teste / avaliação. */
export const quizSchema = z.object({
  title,
  description,
  status,
  course_id: z.guid({ message: "Seleccione o curso." }),
  subject_id: optionalGuid,
  time_limit_minutes: optionalInt(1, 600, "Entre 1 e 600 minutos (ou vazio para sem limite)."),
  passing_score: z.preprocess(
    (v) => Number(v),
    z.number({ message: "Indique a nota mínima." }).int().min(0, { message: "Entre 0 e 100." }).max(100, { message: "Entre 0 e 100." }),
  ),
  max_attempts: optionalInt(1, 100, "Entre 1 e 100 (ou vazio para ilimitado)."),
  shuffle_questions: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

const optionText = z
  .string({ message: "Preencha a alternativa." })
  .trim()
  .min(1, { message: "Preencha a alternativa." })
  .max(1000, { message: "Alternativa demasiado longa." });

/** Pergunta de escolha múltipla com 4 alternativas. */
export const questionSchema = z
  .object({
    statement: z.string().trim().min(3, { message: "Escreva o enunciado." }).max(4000, { message: "Enunciado demasiado longo." }),
    option_a: optionText,
    option_b: optionText,
    option_c: optionText,
    option_d: optionText,
    correct_option: z.enum(["A", "B", "C", "D"], { message: "Indique a resposta correcta." }),
    explanation: z.preprocess(emptyToNull, z.string().trim().max(4000, { message: "Explicação demasiado longa." }).nullable()),
    points: z.preprocess((v) => (v === "" || v == null ? 1 : Number(v)), z.number().int().min(1, { message: "Entre 1 e 100." }).max(100, { message: "Entre 1 e 100." })),
  })
  .refine(
    (q) => new Set([q.option_a, q.option_b, q.option_c, q.option_d].map((o) => o.toLowerCase())).size === 4,
    { message: "As quatro alternativas devem ser diferentes.", path: ["option_d"] },
  );
