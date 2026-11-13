import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { PageHeader } from "@/components/ui/page-header";
import { listCatalog } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Cursos" };

export default function CoursesPage() {
  return (
    <>
      <PageHeader title="Cursos" description="Escolha um curso para ver as disciplinas e as aulas." />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <Catalog />
      </Suspense>
    </>
  );
}

async function Catalog() {
  const { courses } = await listCatalog();

  if (courses.length === 0) {
    return (
      <Card>
        <EmptyState icon={GraduationCap} title="Ainda não há cursos publicados" description="Volte em breve." />
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {courses.map((c) => (
        <li key={c.id}>
          <Link
            href={`/cursos/${c.slug}`}
            className="group flex h-full flex-col gap-4 rounded-card border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <GraduationCap className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold group-hover:text-primary">{c.title}</h2>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <BookOpen className="size-4" aria-hidden />
                  {c.subjectCount} {c.subjectCount === 1 ? "disciplina" : "disciplinas"} · {c.totalLessons} aulas
                </span>
                <span className="font-semibold tabular-nums">{c.percent}%</span>
              </div>
              <Meter value={c.percent} label={`Progresso em ${c.title}`} />
              <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-primary">
                {c.completedLessons > 0 ? "Continuar" : "Começar"} <ArrowRight className="size-4" aria-hidden />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
