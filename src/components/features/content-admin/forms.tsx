"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Markdown } from "@/components/content/markdown";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createNode, createResource, deleteNode, updateNode } from "@/app/admin/conteudos/actions";
import { LEVELS, type Level } from "@/lib/content/levels";
import { cn } from "@/lib/utils";
import { initialFormState } from "@/lib/validations/auth";
import { RESOURCE_TYPES } from "@/lib/validations/content";

const controlCls = cn(
  "w-full rounded-xl border border-border bg-card px-4 text-base text-foreground transition",
  "focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 aria-invalid:border-danger",
);

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-sm text-danger" role="alert">
      {errors[0]}
    </p>
  ) : null;
}

// -----------------------------------------------------------------------------
// Criar (só título) — abre a página de edição a seguir
// -----------------------------------------------------------------------------
export function CreateNodeForm({ level, parentId }: { level: Level; parentId?: string }) {
  const [state, action] = useActionState(createNode, initialFormState);
  const cfg = LEVELS[level];
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="level" value={level} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Título {cfg.article === "a" ? "da nova" : "do novo"} {cfg.label.toLowerCase()}</span>
          <input
            name="title"
            placeholder={`${cfg.article === "a" ? "Nova" : "Novo"} ${cfg.label.toLowerCase()}…`}
            defaultValue={state.values?.title}
            aria-invalid={state.fieldErrors?.title ? true : undefined}
            className={cn(controlCls, "h-11")}
            maxLength={200}
          />
        </label>
        <SubmitButton size="sm" className="h-11" pendingText="…" aria-label={`Adicionar ${cfg.label.toLowerCase()}`}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Adicionar</span>
        </SubmitButton>
      </div>
      <FieldError errors={state.fieldErrors?.title} />
    </form>
  );
}

// -----------------------------------------------------------------------------
// Editar um nó (campos dependem do nível)
// -----------------------------------------------------------------------------
type NodeValues = {
  id: string;
  title: string;
  slug: string;
  status: string;
  description?: string | null;
  cover_image_url?: string | null;
  summary?: string | null;
  content?: string | null;
  video_url?: string | null;
  duration_minutes?: number | null;
  is_free_preview?: boolean;
};

export function NodeForm({ level, node }: { level: Level; node: NodeValues }) {
  const [state, action] = useActionState(updateNode, initialFormState);
  const uid = useId(); // ids únicos (o Next.js pode manter páginas anteriores escondidas no DOM)
  const e = state.fieldErrors ?? {};
  // Após erro, repor o que o administrador escreveu; após sucesso, os valores guardados.
  const v = (k: keyof NodeValues) => state.values?.[k] ?? (node[k] == null ? "" : String(node[k]));

  return (
    // key: após cada submissão o formulário é recriado com os valores devolvidos pela
    // acção. Sem isto, o React repõe os campos com os valores ANTIGOS (o <select> de
    // estado voltava a "Rascunho" e uma 2.ª gravação despublicava a aula sem aviso).
    // O estado (mensagens) vive no componente, por isso não se perde.
    <form key={JSON.stringify(state.values ?? {})} action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="id" value={node.id} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      <FormField label="Título" name="title" defaultValue={v("title")} errors={e.title} required maxLength={200} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Endereço (slug)"
          name="slug"
          defaultValue={v("slug")}
          errors={e.slug}
          hint="Usado no URL. Letras minúsculas, números e hífens."
          required
          maxLength={80}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-status`} className="text-sm font-medium">
            Estado
          </label>
          <select id={`${uid}-status`} name="status" defaultValue={v("status")} className={cn(controlCls, "h-12")}>
            <option value="draft">Rascunho (invisível para estudantes)</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
          <FieldError errors={e.status} />
        </div>
      </div>

      {level !== "lesson" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-description`} className="text-sm font-medium">
            Descrição (opcional)
          </label>
          <textarea
            id={`${uid}-description`}
            name="description"
            rows={3}
            defaultValue={v("description")}
            maxLength={2000}
            aria-invalid={e.description ? true : undefined}
            className={cn(controlCls, "py-3")}
          />
          <FieldError errors={e.description} />
        </div>
      )}

      {level === "course" && (
        <FormField
          label="Imagem de capa (URL https, opcional)"
          name="cover_image_url"
          type="url"
          defaultValue={v("cover_image_url")}
          errors={e.cover_image_url}
        />
      )}

      {level === "lesson" && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-summary`} className="text-sm font-medium">
              Resumo (opcional)
            </label>
            <textarea
              id={`${uid}-summary`}
              name="summary"
              rows={2}
              maxLength={500}
              defaultValue={v("summary")}
              className={cn(controlCls, "py-3")}
            />
            <FieldError errors={e.summary} />
          </div>

          <MarkdownEditor defaultValue={v("content")} errors={e.content} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
            <FormField
              label="Vídeo (YouTube, Vimeo ou outro link https, opcional)"
              name="video_url"
              type="url"
              defaultValue={v("video_url")}
              errors={e.video_url}
            />
            <FormField
              label="Duração (min)"
              name="duration_minutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              defaultValue={v("duration_minutes")}
              errors={e.duration_minutes}
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              name="is_free_preview"
              defaultChecked={state.values ? state.values.is_free_preview === "on" : node.is_free_preview}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              <span className="font-medium">Aula gratuita</span>
              <span className="block text-muted-foreground">
                Visível para todos os estudantes registados, mesmo sem assinatura (útil para demonstração).
              </span>
            </span>
          </label>
        </>
      )}

      <SubmitButton className="self-start" pendingText="A guardar…">
        Guardar alterações
      </SubmitButton>
    </form>
  );
}

function MarkdownEditor({ defaultValue, errors }: { defaultValue: string; errors?: string[] }) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const uid = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`${uid}-content`} className="text-sm font-medium">
          Conteúdo da aula (Markdown)
        </label>
        <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium" role="group" aria-label="Modo do editor">
          <button
            type="button"
            onClick={() => setPreview(false)}
            aria-pressed={!preview}
            className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5", !preview && "bg-card shadow-sm")}
          >
            <Pencil className="size-3.5" aria-hidden /> Escrever
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            aria-pressed={preview}
            className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5", preview && "bg-card shadow-sm")}
          >
            <Eye className="size-3.5" aria-hidden /> Pré-visualizar
          </button>
        </div>
      </div>
      {/* O textarea fica sempre no formulário (escondido na pré-visualização) para ser enviado. */}
      <textarea
        id={`${uid}-content`}
        name="content"
        rows={16}
        value={value}
        onChange={(ev) => setValue(ev.target.value)}
        aria-invalid={errors ? true : undefined}
        className={cn(controlCls, "py-3 font-mono text-sm leading-6", preview && "hidden")}
        placeholder={"# Título\n\nTexto da aula… Use **negrito**, listas com - e tabelas."}
      />
      {preview && (
        <div className="min-h-64 rounded-xl border border-border bg-background p-4">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-muted-foreground">Sem conteúdo.</p>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Dica: # Título, ## Subtítulo, **negrito**, *itálico*, - lista, 1. lista numerada, &gt; destaque, [texto](https://…).
      </p>
      <FieldError errors={errors} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Eliminar (com confirmação)
// -----------------------------------------------------------------------------
export function DeleteNodeForm({ level, id, title }: { level: Level; id: string; title: string }) {
  const [state, action] = useActionState(deleteNode, initialFormState);
  const [confirming, setConfirming] = useState(false);
  const cfg = LEVELS[level];
  return (
    <div className="flex flex-col gap-3">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {!confirming ? (
        <Button variant="secondary" size="sm" className="self-start text-danger" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden /> Eliminar {cfg.label.toLowerCase()}
        </Button>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="id" value={id} />
          <p className="text-sm">
            Eliminar definitivamente {cfg.article} {cfg.label.toLowerCase()} <strong>«{title}»</strong>? Esta acção não
            pode ser desfeita. {level === "lesson" && "Os recursos e o progresso dos estudantes nesta aula também serão eliminados."}
          </p>
          <div className="flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingText="A eliminar…">
              Eliminar definitivamente
            </SubmitButton>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Adicionar recurso a uma aula
// -----------------------------------------------------------------------------
export function CreateResourceForm({ lessonId }: { lessonId: string }) {
  const [state, action] = useActionState(createResource, initialFormState);
  const uid = useId();
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="lessonId" value={lessonId} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}
      <FormField label="Título" name="title" defaultValue={state.values?.title} errors={e.title} maxLength={200} />
      <FormField label="Endereço (https)" name="url" type="url" defaultValue={state.values?.url} errors={e.url} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-type`} className="text-sm font-medium">
          Tipo
        </label>
        <select id={`${uid}-type`} name="type" defaultValue={state.values?.type ?? "link"} className={cn(controlCls, "h-12")}>
          {Object.entries(RESOURCE_TYPES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton size="sm" variant="secondary" className="self-start" pendingText="A adicionar…">
        <Plus className="size-4" aria-hidden /> Adicionar recurso
      </SubmitButton>
    </form>
  );
}
