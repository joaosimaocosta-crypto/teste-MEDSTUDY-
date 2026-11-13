import { ArrowLeft, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AdminOnly } from "@/components/auth/admin-only";
import { DeleteQuizForm, QuestionForm, QuestionItem, QuizForm } from "@/components/features/quizzes/admin-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PUBLICATION_STATUS } from "@/lib/content/levels";
import { getCourseOptions } from "@/lib/services/manuals";
import { getQuizForAdmin } from "@/lib/services/quizzes";

export const metadata: Metadata = { title: "Editar teste · Administração" };

type Props = PageProps<"/admin/testes/[id]">;

export default function EditQuizPage({ params, searchParams }: Props) {
  return (
    <AdminOnly>
      <Link href="/admin/testes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Testes
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <EditQuiz params={params} searchParams={searchParams} />
      </Suspense>
    </AdminOnly>
  );
}

async function EditQuiz({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(id).success) notFound();
  const [data, { courses, subjects }] = await Promise.all([getQuizForAdmin(id), getCourseOptions()]);
  if (!data) notFound();
  const { quiz, questions, stats } = data;
  const st = PUBLICATION_STATUS[quiz.status];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {sp.criado && <Alert variant="success">Teste criado como rascunho. Adicione as perguntas e depois publique.</Alert>}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {quiz.title} <Badge tone={st.tone}>{st.label}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {stats.attempts} tentativas
          {stats.average !== null && ` · média ${stats.average}% · ${stats.passRate}% aprovados`}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader title="Configuração" />
            <QuizForm
              quiz={{
                id: quiz.id,
                title: quiz.title,
                description: quiz.description ?? "",
                status: quiz.status,
                course_id: quiz.course_id,
                subject_id: quiz.subject_id ?? "",
                time_limit_minutes: quiz.time_limit_minutes ? String(quiz.time_limit_minutes) : "",
                passing_score: String(quiz.passing_score),
                max_attempts: quiz.max_attempts ? String(quiz.max_attempts) : "",
                shuffle_questions: quiz.shuffle_questions,
              }}
              courses={courses}
              subjects={subjects}
            />
          </Card>
          <Card>
            <CardHeader title="Zona de perigo" />
            <DeleteQuizForm id={quiz.id} title={quiz.title} />
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-3">
          <Card>
            <CardHeader
              title="Perguntas"
              description={`${questions.length} ${questions.length === 1 ? "pergunta" : "perguntas"} · ${questions.reduce((s, q) => s + q.points, 0)} pontos`}
            />
            {stats.attempts > 0 && (
              <Alert variant="info" className="mb-4">
                Este teste já tem tentativas. Alterar perguntas muda a correcção que os estudantes vêem no histórico (as notas já atribuídas não mudam).
              </Alert>
            )}
            {questions.length === 0 ? (
              <EmptyState icon={ListChecks} title="Ainda não há perguntas" description="Adicione a primeira pergunta abaixo." />
            ) : (
              <ol className="flex flex-col gap-3">
                {questions.map((q, i) => (
                  <QuestionItem
                    key={q.id}
                    quizId={quiz.id}
                    index={i}
                    total={questions.length}
                    question={{
                      id: q.id,
                      statement: q.statement,
                      option_a: q.option_a,
                      option_b: q.option_b,
                      option_c: q.option_c,
                      option_d: q.option_d,
                      correct_option: q.correct_option,
                      explanation: q.explanation ?? "",
                      points: String(q.points),
                    }}
                  />
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <CardHeader title="Nova pergunta" />
            <QuestionForm quizId={quiz.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
