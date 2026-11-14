import { ChevronRight, ClipboardCheck, Clock, History, ListChecks, Lock, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AttemptBadge } from "@/components/features/quizzes/attempt-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { shortDateTime } from "@/lib/format";
import { listQuizCatalog } from "@/lib/services/quizzes";

export const metadata: Metadata = { title: "Testes" };

export default function QuizzesPage() {
  return (
    <>
      <PageHeader title="Testes" description="Avalie os seus conhecimentos com correcção automática e explicações." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <QuizList />
      </Suspense>
    </>
  );
}

async function QuizList() {
  const { quizzes, history } = await listQuizCatalog();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
      <section aria-label="Testes disponíveis" className="lg:col-span-2">
        {quizzes.length === 0 ? (
          <Card>
            <EmptyState icon={ClipboardCheck} title="Ainda não há testes disponíveis" description="Volte em breve." />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {quizzes.map((q) => (
              <li key={q.quiz_id}>
                <Link
                  href={`/testes/${q.quiz_id}`}
                  className="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    {q.is_locked ? <Lock className="size-5" aria-label="Requer assinatura" /> : <ClipboardCheck className="size-5" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{q.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{q.subject_title ?? q.course_title}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ListChecks className="size-3.5" aria-hidden /> {q.question_count} perguntas
                      </span>
                      {q.time_limit_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden /> {q.time_limit_minutes} min
                        </span>
                      )}
                      {q.best_percentage !== null && (
                        <span className="flex items-center gap-1">
                          <Trophy className="size-3.5" aria-hidden /> Melhor: {Math.round(Number(q.best_percentage))}%
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {q.in_progress_attempt_id ? (
                      <Badge tone="warning">Em curso</Badge>
                    ) : q.passed_once ? (
                      <Badge tone="success">Aprovado</Badge>
                    ) : null}
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="self-start">
        <CardHeader title="Histórico de tentativas" action={<History className="size-5 text-muted-foreground" aria-hidden />} />
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não terminou nenhum teste.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((a) => (
              <li key={a.id}>
                <Link href={`/testes/tentativas/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.quiz?.title ?? "Teste"}</p>
                    <p className="text-xs text-muted-foreground">{a.submitted_at ? shortDateTime(a.submitted_at) : "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{Math.round(Number(a.percentage))}%</span>
                    <AttemptBadge status={a.status} passed={a.passed} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
