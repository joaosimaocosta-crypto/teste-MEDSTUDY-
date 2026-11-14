import { Clock, ListChecks, Lock, RotateCcw, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { StudentCrumbs } from "@/components/features/catalog/crumbs";
import { AttemptBadge } from "@/components/features/quizzes/attempt-badge";
import { StartQuizButton } from "@/components/features/quizzes/start-quiz-button";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/lib/auth/routes";
import { shortDateTime } from "@/lib/format";
import { getQuizDetail } from "@/lib/services/quizzes";

export const metadata: Metadata = { title: "Teste" };

export default function QuizDetailPage({ params }: PageProps<"/testes/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
      <QuizDetail params={params} />
    </Suspense>
  );
}

async function QuizDetail({ params }: { params: PageProps<"/testes/[id]">["params"] }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const data = await getQuizDetail(id);
  if (!data) notFound();
  const { quiz, attempts } = data;
  const remainingAttempts = quiz.max_attempts == null ? null : Math.max(0, quiz.max_attempts - quiz.attempts_used);
  const canStart = !quiz.is_locked && (quiz.in_progress_attempt_id || remainingAttempts === null || remainingAttempts > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <StudentCrumbs items={[{ href: ROUTES.quizzes, label: "Testes" }, { label: quiz.title }]} />
      <header>
        <p className="text-sm text-muted-foreground">{quiz.subject_title ?? quiz.course_title}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{quiz.title}</h1>
        {quiz.description && <p className="mt-2 text-muted-foreground">{quiz.description}</p>}
      </header>

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Info icon={ListChecks} label="Perguntas" value={String(quiz.question_count)} />
          <Info icon={Clock} label="Tempo" value={quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : "Sem limite"} />
          <Info icon={Target} label="Nota mínima" value={`${quiz.passing_score}%`} />
          <Info
            icon={RotateCcw}
            label="Tentativas"
            value={quiz.max_attempts == null ? `${quiz.attempts_used} (ilimitadas)` : `${quiz.attempts_used} de ${quiz.max_attempts}`}
          />
        </dl>
        {quiz.best_percentage !== null && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
            <Trophy className="size-4 text-muted-foreground" aria-hidden />
            Melhor resultado: <strong className="tabular-nums">{Math.round(Number(quiz.best_percentage))}%</strong>
          </p>
        )}
      </Card>

      {quiz.is_locked ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Lock className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">Teste exclusivo para assinantes</p>
          <Link href={ROUTES.subscription} className={buttonClasses()}>
            Ver planos
          </Link>
        </Card>
      ) : quiz.in_progress_attempt_id ? (
        <Link href={`/testes/tentativas/${quiz.in_progress_attempt_id}`} className={buttonClasses({ size: "lg", fullWidth: true })}>
          Continuar a tentativa em curso
        </Link>
      ) : canStart ? (
        <div className="flex flex-col gap-2">
          {quiz.time_limit_minutes && (
            <p className="text-center text-sm text-muted-foreground">
              Ao iniciar, terá {quiz.time_limit_minutes} minutos. O teste é submetido automaticamente quando o tempo acabar.
            </p>
          )}
          <StartQuizButton quizId={quiz.quiz_id} label={quiz.attempts_used > 0 ? "Tentar novamente" : "Iniciar teste"} />
        </div>
      ) : (
        <Card>
          <p className="text-center text-sm text-muted-foreground">Já utilizou todas as tentativas disponíveis para este teste.</p>
        </Card>
      )}

      {attempts.length > 0 && (
        <Card>
          <CardHeader title="As suas tentativas" />
          <ul className="divide-y divide-border">
            {attempts.map((a, i) => (
              <li key={a.id}>
                <Link href={`/testes/tentativas/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                  <div>
                    <p className="text-sm font-medium">Tentativa {attempts.length - i}</p>
                    <p className="text-xs text-muted-foreground">{a.submitted_at ? shortDateTime(a.submitted_at) : "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {a.score}/{a.max_score} · {Math.round(Number(a.percentage))}%
                    </span>
                    <AttemptBadge status={a.status} passed={a.passed} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
