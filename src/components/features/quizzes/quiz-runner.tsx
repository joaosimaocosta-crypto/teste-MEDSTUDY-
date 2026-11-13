"use client";

import { ChevronLeft, ChevronRight, Clock, Send } from "lucide-react";
import { use, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { browser } from "react-dom";
import { submitQuiz } from "@/app/(student)/testes/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  points: number;
  position: number;
};

const LETTERS = ["A", "B", "C", "D"] as const;
const storageKey = (attemptId: string) => `medstudy:tentativa:${attemptId}`;

function readSaved(attemptId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey(attemptId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Responder a um teste.
 *  - As respostas ficam guardadas neste dispositivo (localStorage) até submeter,
 *    para não se perderem se a página recarregar ou a ligação cair.
 *  - O prazo vem do servidor (expires_at); ao terminar, submete automaticamente.
 *  - A correcção é sempre feita no servidor.
 */
export function QuizRunner({
  attemptId,
  quizTitle,
  expiresAt,
  questions,
}: {
  attemptId: string;
  quizTitle: string;
  expiresAt: string | null;
  questions: Question[];
}) {
  // Só no browser: lê as respostas guardadas no localStorage.
  use(browser("As respostas em curso são guardadas no localStorage deste dispositivo."));

  const [answers, setAnswers] = useState<Record<string, string>>(() => readSaved(attemptId));
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submittedRef = useRef(false);

  const deadline = expiresAt ? new Date(expiresAt).getTime() : null;
  const remaining = deadline ? deadline - now : null;
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const unanswered = questions.length - answeredCount;
  const q = questions[index];

  const submit = useCallback(
    (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      startTransition(async () => {
        const res = await submitQuiz(attemptId, readSaved(attemptId));
        // Só chega aqui se houve erro (em caso de sucesso o servidor redirecciona).
        if (res?.error) {
          submittedRef.current = false;
          setError(auto ? `O tempo terminou. ${res.error}` : res.error);
        }
      });
    },
    [attemptId],
  );

  // Cronómetro
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  // Tempo esgotado → submeter automaticamente
  useEffect(() => {
    if (remaining !== null && remaining <= 0) submit(true);
  }, [remaining, submit]);

  // Avisar antes de sair da página com um teste em curso
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function choose(questionId: string, letter: string) {
    const next = { ...answers, [questionId]: letter };
    setAnswers(next);
    try {
      localStorage.setItem(storageKey(attemptId), JSON.stringify(next));
    } catch {
      // armazenamento indisponível (modo privado): as respostas ficam só em memória
    }
  }

  const timeUp = remaining !== null && remaining <= 0;
  const urgent = remaining !== null && remaining <= 60_000;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {/* Cabeçalho fixo: título, progresso e tempo */}
      <div className="sticky top-[60px] z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur lg:top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{quizTitle}</p>
          <p className="text-xs text-muted-foreground">
            Respondidas {answeredCount} de {questions.length}
          </p>
        </div>
        {remaining !== null && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
              urgent ? "bg-danger/12 text-danger" : "bg-muted text-foreground",
            )}
            role="timer"
            aria-label={`Tempo restante ${formatClock(remaining)}`}
          >
            <Clock className="size-4" aria-hidden />
            {formatClock(remaining)}
          </div>
        )}
      </div>
      {urgent && !timeUp && (
        <p className="sr-only" aria-live="assertive">
          Falta menos de um minuto.
        </p>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {timeUp && !error && <Alert variant="info">O tempo terminou. A submeter as suas respostas…</Alert>}

      {!reviewing ? (
        <>
          <fieldset className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-6" disabled={pending || timeUp}>
            <legend className="sr-only">Pergunta {index + 1}</legend>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pergunta {index + 1} de {questions.length} · {q.points} {q.points === 1 ? "ponto" : "pontos"}
            </p>
            <p className="mb-5 whitespace-pre-wrap text-base font-medium leading-7 sm:text-lg">{q.statement}</p>
            <div className="flex flex-col gap-2.5">
              {LETTERS.map((letter) => {
                const text = q[`option_${letter.toLowerCase()}` as "option_a"];
                const checked = answers[q.id] === letter;
                return (
                  <label
                    key={letter}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition",
                      checked ? "border-primary bg-accent" : "border-border hover:bg-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={letter}
                      checked={checked}
                      onChange={() => choose(q.id, letter)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {letter}
                    </span>
                    <span className="pt-0.5 text-sm leading-6 sm:text-base">{text}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
              <ChevronLeft className="size-4" aria-hidden /> Anterior
            </Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => setIndex((i) => i + 1)}>
                Seguinte <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={() => setReviewing(true)}>Rever e submeter</Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Submeter o teste?</h2>
          <p className="text-sm text-muted-foreground">
            {unanswered === 0
              ? "Respondeu a todas as perguntas. Depois de submeter não poderá alterar as respostas."
              : `Tem ${unanswered} ${unanswered === 1 ? "pergunta" : "perguntas"} por responder (contam como erradas). Depois de submeter não poderá alterar as respostas.`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={() => submit(false)} disabled={pending || timeUp}>
              <Send className="size-4" aria-hidden />
              {pending ? "A submeter…" : "Submeter respostas"}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setReviewing(false)} disabled={pending}>
              Voltar às perguntas
            </Button>
          </div>
        </div>
      )}

      {/* Navegação rápida entre perguntas */}
      <nav aria-label="Perguntas" className="rounded-card border border-border bg-card p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Ir para a pergunta</p>
        <ol className="grid grid-cols-6 gap-2 sm:grid-cols-10">
          {questions.map((question, i) => {
            const done = Boolean(answers[question.id]);
            return (
              <li key={question.id}>
                <button
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setReviewing(false);
                  }}
                  aria-current={i === index && !reviewing ? "step" : undefined}
                  aria-label={`Pergunta ${i + 1}${done ? ", respondida" : ", por responder"}`}
                  className={cn(
                    "flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition",
                    done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    i === index && !reviewing && "ring-2 ring-ring ring-offset-2 ring-offset-card",
                  )}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

/** Limpa as respostas guardadas no dispositivo (depois de a tentativa ser corrigida). */
export function ClearSavedAnswers({ attemptId }: { attemptId: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(storageKey(attemptId));
    } catch {
      // ignorar
    }
  }, [attemptId]);
  return null;
}
