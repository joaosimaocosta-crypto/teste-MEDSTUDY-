"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { deleteManual, saveManual } from "@/app/admin/manuais/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { initialFormState } from "@/lib/validations/auth";

type Option = { id: string; title: string };
type SubjectOption = Option & { course_id: string };

export type ManualValues = {
  id?: string;
  title: string;
  description: string;
  status: string;
  course_id: string;
  subject_id: string;
  pdf_url: string;
  page_count: string;
};

const controlCls = cn(
  "w-full rounded-xl border border-border bg-card px-4 text-base text-foreground transition",
  "focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 aria-invalid:border-danger",
);

export function ManualForm({
  manual,
  courses,
  subjects,
}: {
  manual: ManualValues;
  courses: Option[];
  subjects: SubjectOption[];
}) {
  const [state, action] = useActionState(saveManual, initialFormState);
  const uid = useId();
  const v = { ...manual, ...(state.values as Partial<ManualValues> | undefined) };
  const e = state.fieldErrors ?? {};
  // Curso e disciplina controlados: a lista de disciplinas depende do curso.
  const [courseId, setCourseId] = useState(v.course_id || courses[0]?.id || "");
  const [subjectId, setSubjectId] = useState(v.subject_id);
  const courseSubjects = subjects.filter((s) => s.course_id === courseId);

  return (
    <form key={JSON.stringify(state.values ?? {})} action={action} className="flex flex-col gap-4" noValidate>
      {manual.id && <input type="hidden" name="id" value={manual.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      <FormField label="Nome do manual" name="title" defaultValue={v.title} errors={e.title} maxLength={200} required />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-description`} className="text-sm font-medium">
          Descrição (opcional)
        </label>
        <textarea
          id={`${uid}-description`}
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={v.description}
          className={cn(controlCls, "py-3")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-course`} className="text-sm font-medium">
            Curso
          </label>
          <select
            id={`${uid}-course`}
            name="course_id"
            value={courseId}
            onChange={(ev) => {
              setCourseId(ev.target.value);
              setSubjectId("");
            }}
            aria-invalid={e.course_id ? true : undefined}
            className={cn(controlCls, "h-12")}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {e.course_id && <p className="text-sm text-danger">{e.course_id[0]}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-subject`} className="text-sm font-medium">
            Disciplina (opcional)
          </label>
          <select
            id={`${uid}-subject`}
            name="subject_id"
            value={subjectId}
            onChange={(ev) => setSubjectId(ev.target.value)}
            aria-invalid={e.subject_id ? true : undefined}
            className={cn(controlCls, "h-12")}
          >
            <option value="">— Todo o curso —</option>
            {courseSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {e.subject_id && <p className="text-sm text-danger">{e.subject_id[0]}</p>}
        </div>
      </div>

      <FormField
        label="Endereço do PDF (Lunes Host)"
        name="pdf_url"
        type="url"
        placeholder="https://…/manual.pdf"
        defaultValue={v.pdf_url}
        errors={e.pdf_url}
        hint="Nunca é mostrado aos estudantes: o PDF é entregue pela rota protegida da plataforma."
        required
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Número de páginas (opcional)"
          name="page_count"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={v.page_count}
          errors={e.page_count}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-status`} className="text-sm font-medium">
            Estado de publicação
          </label>
          <select id={`${uid}-status`} name="status" defaultValue={v.status} className={cn(controlCls, "h-12")}>
            <option value="draft">Rascunho (invisível para estudantes)</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
        </div>
      </div>

      <SubmitButton className="self-start" pendingText="A guardar…">
        {manual.id ? "Guardar alterações" : "Criar manual"}
      </SubmitButton>
    </form>
  );
}

export function DeleteManualForm({ id, title }: { id: string; title: string }) {
  const [state, action] = useActionState(deleteManual, initialFormState);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {!confirming ? (
        <Button variant="secondary" size="sm" className="self-start text-danger" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden /> Eliminar manual
        </Button>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm">
            Eliminar o manual <strong>«{title}»</strong> da plataforma? O ficheiro na Lunes Host não é apagado.
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
