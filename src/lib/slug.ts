/**
 * Gera um "slug" para URLs a partir de um título:
 * "Anatomia e Fisiologia" → "anatomia-e-fisiologia"
 * (remove acentos, minúsculas, só letras/números separados por hífens).
 */
export function slugify(input: string, maxLength = 80) {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "item";
}

/** Formato aceite pela base de dados (ver CHECK nas tabelas). */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
