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
