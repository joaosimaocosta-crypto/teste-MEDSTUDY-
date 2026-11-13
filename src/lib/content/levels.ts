/**
 * Hierarquia de conteúdos: Curso → Disciplina → Módulo → Capítulo → Aula.
 * Uma única configuração descreve cada nível; páginas e acções da administração
 * são genéricas e usam-na (assim, adicionar um campo não obriga a repetir código).
 */

export const LEVEL_KEYS = ["course", "subject", "module", "chapter", "lesson"] as const;
export type Level = (typeof LEVEL_KEYS)[number];

type LevelConfig = {
  table: "courses" | "subjects" | "modules" | "chapters" | "lessons";
  /** Coluna que liga ao nível acima (null no curso). */
  parentKey: "course_id" | "subject_id" | "module_id" | "chapter_id" | null;
  parent: Level | null;
  child: Level | null;
  label: string;
  plural: string;
  /** Artigo para mensagens: "o curso", "a disciplina". */
  article: "o" | "a";
  /** Segmento do URL na administração. */
  adminSegment: string;
};

export const LEVELS: Record<Level, LevelConfig> = {
  course: {
    table: "courses",
    parentKey: null,
    parent: null,
    child: "subject",
    label: "Curso",
    plural: "Cursos",
    article: "o",
    adminSegment: "cursos",
  },
  subject: {
    table: "subjects",
    parentKey: "course_id",
    parent: "course",
    child: "module",
    label: "Disciplina",
    plural: "Disciplinas",
    article: "a",
    adminSegment: "disciplinas",
  },
  module: {
    table: "modules",
    parentKey: "subject_id",
    parent: "subject",
    child: "chapter",
    label: "Módulo",
    plural: "Módulos",
    article: "o",
    adminSegment: "modulos",
  },
  chapter: {
    table: "chapters",
    parentKey: "module_id",
    parent: "module",
    child: "lesson",
    label: "Capítulo",
    plural: "Capítulos",
    article: "o",
    adminSegment: "capitulos",
  },
  lesson: {
    table: "lessons",
    parentKey: "chapter_id",
    parent: "chapter",
    child: null,
    label: "Aula",
    plural: "Aulas",
    article: "a",
    adminSegment: "aulas",
  },
};

export function adminPath(level: Level, id: string) {
  return `/admin/${LEVELS[level].adminSegment}/${id}`;
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVEL_KEYS as readonly string[]).includes(value);
}

export const PUBLICATION_STATUS = {
  draft: { label: "Rascunho", tone: "neutral" },
  published: { label: "Publicado", tone: "success" },
  archived: { label: "Arquivado", tone: "warning" },
} as const;

export type PublicationStatus = keyof typeof PUBLICATION_STATUS;
