import { ClipboardCheck, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PUBLICATION_STATUS } from "@/lib/content/levels";
import { listQuizzesForAdmin } from "@/lib/services/quizzes";

export const metadata: Metadata = { title: "Testes · Administração" };

export default function AdminQuizzesPage() {
  return (
    <AdminOnly>
      <PageHeader
        title="Testes"
        description="Avaliações de escolha múltipla com correcção automática."
        action={
          <Link href="/admin/testes/novo" className={buttonClasses({ size: "sm" })}>
            <Plus className="size-4" aria-hidden /> Novo teste
          </Link>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <QuizList />
      </Suspense>
    </AdminOnly>
  );
}

async function QuizList() {
  const quizzes = await listQuizzesForAdmin();
  return (
    <Card className="p-0 sm:p-0">
      {quizzes.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Ainda não há testes" />
      ) : (
        <ul className="divide-y divide-border">
          {quizzes.map((q) => {
            const st = PUBLICATION_STATUS[q.status];
            return (
              <li key={q.id}>
                <Link href={`/admin/testes/${q.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted sm:px-5">
                  <ClipboardCheck className="size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{q.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.subject?.title ?? q.course?.title} · {q.questionCount} perguntas · {q.attemptCount} tentativas
                      {q.time_limit_minutes ? ` · ${q.time_limit_minutes} min` : ""}
                    </p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
