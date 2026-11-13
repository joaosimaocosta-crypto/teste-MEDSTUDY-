import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, FileText, Link2, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteResource, moveNode } from "@/app/admin/conteudos/actions";
import { LEVELS, PUBLICATION_STATUS, adminPath, type Level } from "@/lib/content/levels";
import { getNodePage, type Crumb, type NodeSummary } from "@/lib/services/content-admin";
import { RESOURCE_TYPES } from "@/lib/validations/content";
import { CreateNodeForm, CreateResourceForm, DeleteNodeForm, NodeForm } from "./forms";

/** Página de edição genérica: curso, disciplina, módulo, capítulo ou aula. */
export async function NodePage({ level, params }: { level: Level; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const data = await getNodePage(level, id);
  if (!data) notFound();

  const { row, ancestors, children, resources, blockers } = data;
  const cfg = LEVELS[level];
  const status = PUBLICATION_STATUS[row.status];
  const previewHref = studentHref(level, row);

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <Breadcrumbs crumbs={ancestors} current={row.title} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{cfg.label}</p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="min-w-0 [overflow-wrap:anywhere]">{row.title}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </h1>
        </div>
        {previewHref && row.status === "published" && (
          <Link href={previewHref} className={buttonClasses({ variant: "secondary", size: "sm" })} target="_blank">
            <ExternalLink className="size-4" aria-hidden /> Ver como estudante
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Detalhes" />
          <NodeForm
            level={level}
            node={{
              id: row.id,
              title: row.title,
              slug: row.slug,
              status: row.status,
              description: row.description as string | null,
              cover_image_url: row.cover_image_url as string | null,
              summary: row.summary as string | null,
              content: row.content as string | null,
              video_url: row.video_url as string | null,
              duration_minutes: row.duration_minutes as number | null,
              is_free_preview: row.is_free_preview as boolean,
            }}
          />
        </Card>

        <div className="flex flex-col gap-5 lg:gap-6">
          {cfg.child ? (
            <ChildrenPanel level={cfg.child} parentId={row.id} items={children} />
          ) : (
            <ResourcesPanel lessonId={row.id} resources={resources} />
          )}

          <Card>
            <CardHeader title="Zona de perigo" />
            {level === "course" && (blockers.manuals > 0 || blockers.quizzes > 0) && (
              <p className="mb-3 text-sm text-muted-foreground">
                Este curso tem {blockers.manuals} manuais e {blockers.quizzes} testes associados.
              </p>
            )}
            <p className="mb-3 text-sm text-muted-foreground">
              Prefira <strong>Arquivado</strong> para esconder sem perder dados. Só é possível eliminar quando não
              existem conteúdos dentro.
            </p>
            <DeleteNodeForm level={level} id={row.id} title={row.title} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function studentHref(level: Level, row: NodeSummary) {
  if (level === "lesson") return `/aulas/${row.id}`;
  if (level === "course") return `/cursos/${row.slug}`;
  return null;
}

export function Breadcrumbs({ crumbs, current }: { crumbs: Crumb[]; current: string }) {
  return (
    <nav aria-label="Caminho" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        <li>
          <Link href="/admin/cursos" className="hover:text-foreground">
            Cursos
          </Link>
        </li>
        {crumbs.map((c) => (
          <li key={c.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={adminPath(c.level, c.id)} className="max-w-48 truncate hover:text-foreground">
              {c.title}
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-1">
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="max-w-48 truncate font-medium text-foreground" aria-current="page">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}

/** Lista de filhos com ordenação, estado e criação. */
export function ChildrenPanel({ level, parentId, items }: { level: Level; parentId?: string; items: NodeSummary[] }) {
  const cfg = LEVELS[level];
  return (
    <Card>
      <CardHeader title={cfg.plural} description={`${items.length} ${items.length === 1 ? "item" : "itens"}`} />
      {items.length === 0 ? (
        <EmptyState icon={FileText} title={`Ainda não há ${cfg.plural.toLowerCase()}`} />
      ) : (
        <ol className="mb-4 flex flex-col gap-2">
          {items.map((item, i) => {
            const st = PUBLICATION_STATUS[item.status];
            return (
              <li key={item.id} className="flex items-center gap-2 rounded-xl border border-border p-2 pl-3">
                <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <Link href={adminPath(level, item.id)} className="min-w-0 flex-1 hover:text-primary">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <Badge tone={st.tone} className="mt-1">
                    {st.label}
                  </Badge>
                </Link>
                <div className="flex shrink-0 flex-col">
                  <MoveButton level={level} id={item.id} direction="up" disabled={i === 0} />
                  <MoveButton level={level} id={item.id} direction="down" disabled={i === items.length - 1} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <CreateNodeForm level={level} parentId={parentId} />
    </Card>
  );
}

function MoveButton({ level, id, direction, disabled }: { level: Level; id: string; direction: "up" | "down"; disabled: boolean }) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <form action={moveNode}>
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Mover para cima" : "Mover para baixo"}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </form>
  );
}

function ResourcesPanel({
  lessonId,
  resources,
}: {
  lessonId: string;
  resources: { id: string; title: string; type: string; url: string }[];
}) {
  return (
    <Card>
      <CardHeader title="Recursos da aula" description="Links, documentos, vídeos complementares" />
      {resources.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl border border-border p-2 pl-3">
              <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {RESOURCE_TYPES[r.type as keyof typeof RESOURCE_TYPES] ?? r.type} · {r.url}
                </p>
              </div>
              <form action={deleteResource}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  aria-label={`Remover recurso ${r.title}`}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <CreateResourceForm lessonId={lessonId} />
    </Card>
  );
}
