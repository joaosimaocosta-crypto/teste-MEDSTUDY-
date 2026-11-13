import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { StudentCrumbs } from "@/components/features/catalog/crumbs";
import { AttemptBadge } from "@/components/features/quizzes/attempt-badge";
import { ClearSavedAnswers, QuizRunner } from "@/components/features/quizzes/quiz-runner";
import { StartQuizButton } from "@/components/features/quizzes/start-quiz-button";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { ROUTES } from "@/lib/auth/routes";
import { shortDateTime } from "@/lib/format";
import { getAttempt } from "@/lib/services/quizzes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Teste" };

type Params = PageProps<"/testes/tentativas/[attemptId]">["params"];

export default function AttemptPage({ params }: PageProps<"/testes/tentativas/[attemptId]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar o teste" />}>
      <Attempt params={params} />
    </Suspense>
  );
}

async function Attempt({ params }: { params: Params }) {
  const { attemptId } = await params;
  if (!z.guid().safeParse(attemptId).success) notFound();
  const data = await getAttempt(attemptId);
  if (!data) notFound();
  const { attempt } = data;
  const quizTitle = attempt.quiz?.title ?? "Teste";

  // ---------------- Em curso: responder ----------------
  if (data.questions) {
    if (data.questions.length === 0) notFound();
    return (
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar as perguntas" />}>
        <QuizRunner attemptId={attempt.id} quizTitle={quizTitle} expiresAt={attempt.expires_at} questions={data.questions} />
      </Suspense>
    );
  }

  // ---------------- Terminada: resultado e correcção ----------------
  const review = data.review ?? [];
  const pct = Math.round(Number(attempt.percentage));
  const correct = review.filter((r) => r.is_correct).length;
  const passMark = attempt.quiz?.passing_score ?? 50;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <ClearSavedAnswers attemptId={attempt.id} />
      <StudentCrumbs
        items={[
          { href: ROUTES.quizzes, label: "Testes" },
          { href: `/testes/${attempt.quiz_id}`, label: quizTitle },
          { label: "Resultado" },
        ]}
      />

      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <AttemptBadge status={attempt.status} passed={attempt.passed} />
        <p className="text-5xl font-bold tabular-nums">{pct}%</p>
        <p className="text-sm text-muted-foreground">
          {attempt.score} de {attempt.max_score} pontos · {correct} de {review.length} respostas certas · nota mínima {passMark}%
        </p>
        <div className="w-full max-w-xs">
          <Meter value={pct} label="Resultado do teste" />
        </div>
        {attempt.status === "expired" && (
          <p className="max-w-md text-sm text-muted-foreground">
            O teste não foi submetido dentro do tempo limite, por isso as respostas não foram consideradas.
          </p>
        )}
        {attempt.submitted_at && <p className="text-xs text-muted-foreground">Terminado em {shortDateTime(attempt.submitted_at)}</p>}
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        {data.canRetry && (
          <div className="sm:flex-1">
            <StartQuizButton quizId={attempt.quiz_id} label="Tentar novamente" />
          </div>
        )}
        <Link href={ROUTES.quizzes} className={buttonClasses({ variant: "secondary", size: "lg", className: "sm:flex-1" })}>
          Voltar aos testes
        </Link>
      </div>

      <section aria-labelledby="correcao" className="flex flex-col gap-3">
        <h2 id="correcao" className="text-lg font-semibold">
          Correcção
        </h2>
        {review.map((r, i) => {
          const options = [
            ["A", r.option_a],
            ["B", r.option_b],
            ["C", r.option_c],
            ["D", r.option_d],
          ] as const;
          const StatusIcon = r.is_correct ? CheckCircle2 : r.selected_option ? XCircle : CircleSlash;
          return (
            <Card key={r.question_id}>
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <StatusIcon
                  className={cn("size-4", r.is_correct ? "text-success" : r.selected_option ? "text-danger" : "text-muted-foreground")}
                  aria-hidden
                />
                Pergunta {i + 1} · {r.is_correct ? "Certa" : r.selected_option ? "Errada" : "Sem resposta"}
              </p>
              <p className="mb-3 whitespace-pre-wrap font-medium leading-7">{r.statement}</p>
              <ul className="flex flex-col gap-2">
                {options.map(([letter, text]) => {
                  const isCorrect = letter === r.correct_option;
                  const isChosen = letter === r.selected_option;
                  return (
                    <li
                      key={letter}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-sm",
                        isCorrect ? "border-success/50 bg-success/10" : isChosen ? "border-danger/50 bg-danger/10" : "border-border",
                      )}
                    >
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{letter}</span>
                      <span className="flex-1 pt-0.5">{text}</span>
                      {isCorrect && <span className="shrink-0 text-xs font-semibold text-success">Correcta</span>}
                      {isChosen && !isCorrect && <span className="shrink-0 text-xs font-semibold text-danger">A sua resposta</span>}
                    </li>
                  );
                })}
              </ul>
              {r.explanation && (
                <p className="mt-3 rounded-xl bg-accent px-3 py-2.5 text-sm">
                  <span className="font-semibold">Explicação: </span>
                  {r.explanation}
                </p>
              )}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
