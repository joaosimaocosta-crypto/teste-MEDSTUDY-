"use client";

import { ArrowDown, ArrowUp, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { deleteQuestion, deleteQuiz, moveQuestion, saveQuestion, saveQuiz } from "@/app/admin/testes/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { initialFormState } from "@/lib/validations/auth";

const controlCls = cn(
  "w-full rounded-xl border border-border bg-card px-4 text-base text-foreground transition",
  "focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 aria-invalid:border-danger",
);
const Err = ({ e }: { e?: string[] }) => (e?.length ? <p className="text-sm text-danger" role="alert">{e[0]}</p> : null);

type Option = { id: string; title: string };

// =============================================================================
// Teste
// =============================================================================
export type QuizValues = {
  id?: string;
  title: string;
  description: string;
  status: string;
  course_id: string;
  subject_id: string;
  time_limit_minutes: string;
  passing_score: string;
  max_attempts: string;
  shuffle_questions: boolean;
};

export function QuizForm({
  quiz,
  courses,
  subjects,
}: {
  quiz: QuizValues;
  courses: Option[];
  subjects: (Option & { course_id: string })[];
}) {
  const [state, action] = useActionState(saveQuiz, initialFormState);
  const uid = useId();
  const sv = state.values as Partial<Record<keyof QuizValues, string>> | undefined;
  const v = (k: keyof QuizValues) => sv?.[k] ?? String(quiz[k] ?? "");
  const e = state.fieldErrors ?? {};
  const [courseId, setCourseId] = useState(quiz.course_id || courses[0]?.id || "");
  const [subjectId, setSubjectId] = useState(quiz.subject_id);

  return (
    <form key={JSON.stringify(state.values ?? {})} action={action} className="flex flex-col gap-4" noValidate>
      {quiz.id && <input type="hidden" name="id" value={quiz.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      <FormField label="Título" name="title" defaultValue={v("title")} errors={e.title} maxLength={200} required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-desc`} className="text-sm font-medium">
          Instruções / descrição (opcional)
        </label>
        <textarea id={`${uid}-desc`} name="description" rows={2} maxLength={2000} defaultValue={v("description")} className={cn(controlCls, "py-3")} />
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
            className={cn(controlCls, "h-12")}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <Err e={e.course_id} />
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
            className={cn(controlCls, "h-12")}
          >
            <option value="">— Todo o curso —</option>
            {subjects
              .filter((s) => s.course_id === courseId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
          <Err e={e.subject_id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          label="Tempo limite (min)"
          name="time_limit_minutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          placeholder="Sem limite"
          defaultValue={v("time_limit_minutes")}
          errors={e.time_limit_minutes}
        />
        <FormField
          label="Nota mínima (%)"
          name="passing_score"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          defaultValue={v("passing_score")}
          errors={e.passing_score}
        />
        <FormField
          label="Máx. tentativas"
          name="max_attempts"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          placeholder="Ilimitadas"
          defaultValue={v("max_attempts")}
          errors={e.max_attempts}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
          <input
            type="checkbox"
            name="shuffle_questions"
            defaultChecked={sv ? sv.shuffle_questions === "on" : quiz.shuffle_questions}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span>
            <span className="font-medium">Baralhar perguntas</span>
            <span className="block text-muted-foreground">Ordem diferente em cada tentativa.</span>
          </span>
        </label>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-status`} className="text-sm font-medium">
            Estado
          </label>
          <select id={`${uid}-status`} name="status" defaultValue={v("status")} className={cn(controlCls, "h-12")} aria-invalid={e.status ? true : undefined}>
            <option value="draft">Rascunho (invisível para estudantes)</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
          <Err e={e.status} />
        </div>
      </div>

      <SubmitButton className="self-start" pendingText="A guardar…">
        {quiz.id ? "Guardar alterações" : "Criar teste"}
      </SubmitButton>
    </form>
  );
}

export function DeleteQuizForm({ id, title }: { id: string; title: string }) {
  const [state, action] = useActionState(deleteQuiz, initialFormState);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {!confirming ? (
        <Button variant="secondary" size="sm" className="self-start text-danger" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden /> Eliminar teste
        </Button>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm">
            Eliminar o teste <strong>«{title}»</strong> e todas as suas perguntas?
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

// =============================================================================
// Perguntas
// =============================================================================
export type QuestionValues = {
  id?: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
  points: string;
};

const EMPTY_QUESTION: QuestionValues = {
  statement: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "",
  explanation: "",
  points: "1",
};

export function QuestionForm({
  quizId,
  question = EMPTY_QUESTION,
  onDone,
}: {
  quizId: string;
  question?: QuestionValues;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveQuestion, initialFormState);
  const uid = useId();
  const isEdit = Boolean(question.id);
  // Após criar com sucesso, o formulário fica vazio para a próxima pergunta.
  const base = !isEdit && state.success ? EMPTY_QUESTION : question;
  const v = (k: keyof QuestionValues) => (state.values && !(!isEdit && state.success) ? state.values[k] : base[k]) ?? "";
  const e = state.fieldErrors ?? {};

  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="quizId" value={quizId} />
      {question.id && <input type="hidden" name="id" value={question.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-st`} className="text-sm font-medium">
          Enunciado
        </label>
        <textarea
          id={`${uid}-st`}
          name="statement"
          rows={3}
          maxLength={4000}
          defaultValue={v("statement")}
          aria-invalid={e.statement ? true : undefined}
          className={cn(controlCls, "py-3")}
        />
        <Err e={e.statement} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Alternativas — marque a correcta</legend>
        {(["A", "B", "C", "D"] as const).map((letter) => {
          const key = `option_${letter.toLowerCase()}` as "option_a";
          return (
            <div key={letter} className="flex items-start gap-2">
              <label className="mt-3 flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                <input
                  type="radio"
                  name="correct_option"
                  value={letter}
                  defaultChecked={v("correct_option") === letter}
                  className="size-5 accent-primary"
                  aria-label={`Alternativa ${letter} é a correcta`}
                />
                {letter}
              </label>
              <div className="flex-1">
                <input
                  name={key}
                  defaultValue={v(key)}
                  maxLength={1000}
                  aria-label={`Alternativa ${letter}`}
                  aria-invalid={e[key] ? true : undefined}
                  className={cn(controlCls, "h-11")}
                />
                <Err e={e[key]} />
              </div>
            </div>
          );
        })}
        <Err e={e.correct_option} />
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-ex`} className="text-sm font-medium">
          Explicação da resposta (mostrada após submeter)
        </label>
        <textarea id={`${uid}-ex`} name="explanation" rows={2} maxLength={4000} defaultValue={v("explanation")} className={cn(controlCls, "py-3")} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <FormField label="Pontos" name="points" type="number" min={1} max={100} defaultValue={v("points")} errors={e.points} />
        </div>
        <SubmitButton size="sm" className="h-12" pendingText="A guardar…">
          {isEdit ? "Guardar pergunta" : (
            <>
              <Plus className="size-4" aria-hidden /> Adicionar pergunta
            </>
          )}
        </SubmitButton>
        {onDone && (
          <Button variant="ghost" size="sm" className="h-12" onClick={onDone}>
            Fechar
          </Button>
        )}
      </div>
    </form>
  );
}

/** Uma pergunta na lista do administrador (ver / editar / mover / eliminar). */
export function QuestionItem({
  quizId,
  index,
  total,
  question,
}: {
  quizId: string;
  index: number;
  total: number;
  question: QuestionValues & { id: string };
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pergunta {index + 1} · {question.points} {question.points === "1" ? "ponto" : "pontos"}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          {(["up", "down"] as const).map((dir) => (
            <form key={dir} action={moveQuestion}>
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="quizId" value={quizId} />
              <input type="hidden" name="direction" value={dir} />
              <button
                type="submit"
                disabled={dir === "up" ? index === 0 : index === total - 1}
                aria-label={dir === "up" ? "Mover para cima" : "Mover para baixo"}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                {dir === "up" ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
              </button>
            </form>
          ))}
          <button
            type="button"
            onClick={() => setEditing((x) => !x)}
            aria-label="Editar pergunta"
            aria-expanded={editing}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Eliminar pergunta"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <form action={deleteQuestion} className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-danger/10 p-3 text-sm">
          <input type="hidden" name="id" value={question.id} />
          <span className="flex-1">Eliminar esta pergunta?</span>
          <SubmitButton variant="danger" size="sm" pendingText="…">
            Eliminar
          </SubmitButton>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
        </form>
      )}

      {editing ? (
        <QuestionForm quizId={quizId} question={question} onDone={() => setEditing(false)} />
      ) : (
        <>
          <p className="mb-2 whitespace-pre-wrap font-medium">{question.statement}</p>
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((l) => {
              const correct = question.correct_option === l;
              return (
                <li key={l} className={cn("flex items-start gap-2 rounded-lg px-2 py-1.5", correct && "bg-success/10 font-medium")}>
                  <span className="font-semibold">{l}.</span>
                  <span className="flex-1">{question[`option_${l.toLowerCase()}` as "option_a"]}</span>
                  {correct && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Resposta correcta" />}
                </li>
              );
            })}
          </ul>
          {question.explanation && <p className="mt-2 text-sm text-muted-foreground">Explicação: {question.explanation}</p>}
        </>
      )}
    </li>
  );
}
