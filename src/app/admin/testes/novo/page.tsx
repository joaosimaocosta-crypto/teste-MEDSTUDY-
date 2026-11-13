import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { QuizForm } from "@/components/features/quizzes/admin-forms";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCourseOptions } from "@/lib/services/manuals";

export const metadata: Metadata = { title: "Novo teste · Administração" };

export default function NewQuizPage() {
  return (
    <AdminOnly>
      <Link href="/admin/testes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Testes
      </Link>
      <PageHeader title="Novo teste" description="Depois de criar, adicione as perguntas e publique." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <NewQuiz />
      </Suspense>
    </AdminOnly>
  );
}

async function NewQuiz() {
  const { courses, subjects } = await getCourseOptions();
  if (courses.length === 0) {
    return (
      <Card>
        <EmptyState icon={BookOpen} title="Crie primeiro um curso" />
      </Card>
    );
  }
  return (
    <Card className="max-w-3xl">
      <QuizForm
        quiz={{
          title: "",
          description: "",
          status: "draft",
          course_id: courses[0].id,
          subject_id: "",
          time_limit_minutes: "",
          passing_score: "50",
          max_attempts: "",
          shuffle_questions: false,
        }}
        courses={courses}
        subjects={subjects}
      />
    </Card>
  );
}
