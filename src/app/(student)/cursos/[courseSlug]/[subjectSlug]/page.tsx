import { CheckCircle2, Clock, Lock, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudentCrumbs } from "@/components/features/catalog/crumbs";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { ROUTES } from "@/lib/auth/routes";
import { getSubject, type OutlineLesson } from "@/lib/services/catalog";
import { SLUG_PATTERN } from "@/lib/slug";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Disciplina" };

type Params = PageProps<"/cursos/[courseSlug]/[subjectSlug]">["params"];

export default function SubjectPage({ params }: PageProps<"/cursos/[courseSlug]/[subjectSlug]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
      <SubjectContent params={params} />
    </Suspense>
  );
}

async function SubjectContent({ params }: { params: Params }) {
  const { courseSlug, subjectSlug } = await params;
  if (!SLUG_PATTERN.test(courseSlug) || !SLUG_PATTERN.test(subjectSlug)) notFound();
  const data = await getSubject(courseSlug, subjectSlug);
  if (!data) notFound();
  const { course, subject, modules, totals, nextLessonId, hasLocked } = data;

  return (
    <>
      <StudentCrumbs
        items={[
          { href: "/cursos", label: "Cursos" },
          { href: `/cursos/${course.slug}`, label: course.title },
          { label: subject.title },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <header>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{subject.title}</h1>
            {subject.description && <p className="mt-1 text-muted-foreground">{subject.description}</p>}
          </header>

          {modules.length === 0 ? (
            <Card>
              <EmptyState icon={PlayCircle} title="Ainda não há aulas publicadas nesta disciplina" />
            </Card>
          ) : (
            modules.map((m, mi) => (
              <section key={m.id} aria-labelledby={`mod-${m.id}`} className="flex flex-col gap-3">
                <h2 id={`mod-${m.id}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Módulo {mi + 1} · {m.title}
                </h2>
                {m.chapters.map((c) => (
                  <Card key={c.id} className="p-0 sm:p-0">
                    <h3 className="border-b border-border px-4 py-3 font-semibold sm:px-5">{c.title}</h3>
                    <ol className="divide-y divide-border">
                      {c.lessons.map((l) => (
                        <LessonRow key={l.id} lesson={l} />
                      ))}
                    </ol>
                  </Card>
                ))}
              </section>
            ))
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
          <Card>
            <p className="text-sm text-muted-foreground">O seu progresso</p>
            <p className="mb-2 text-2xl font-semibold tabular-nums">
              {totals.percent}% <span className="text-sm font-normal text-muted-foreground">({totals.completed}/{totals.lessons} aulas)</span>
            </p>
            <Meter value={totals.percent} label={`Progresso em ${subject.title}`} />
            {nextLessonId && (
              <Link href={`/aulas/${nextLessonId}`} className={buttonClasses({ fullWidth: true, className: "mt-4" })}>
                <PlayCircle className="size-4" aria-hidden />
                {totals.completed > 0 ? "Continuar" : "Começar"}
              </Link>
            )}
          </Card>
          {hasLocked && (
            <Card className="border-primary/25 bg-accent">
              <p className="flex items-center gap-2 font-semibold">
                <Lock className="size-4" aria-hidden /> Conteúdo exclusivo
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Algumas aulas exigem uma assinatura activa. Active o seu plano para desbloquear tudo.
              </p>
              <Link href={ROUTES.subscription} className={buttonClasses({ size: "sm", className: "mt-3" })}>
                Ver planos
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function LessonRow({ lesson }: { lesson: OutlineLesson }) {
  const Icon = lesson.isCompleted ? CheckCircle2 : lesson.isLocked ? Lock : PlayCircle;
  const state = lesson.isCompleted ? "Concluída" : lesson.isLocked ? "Bloqueada — requer assinatura" : "Disponível";
  return (
    <li>
      <Link href={`/aulas/${lesson.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted sm:px-5">
        <Icon
          className={cn(
            "size-5 shrink-0",
            lesson.isCompleted ? "text-success" : lesson.isLocked ? "text-muted-foreground" : "text-primary",
          )}
          aria-label={state}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", lesson.isLocked && "text-muted-foreground")}>{lesson.title}</p>
          {lesson.summary && <p className="truncate text-xs text-muted-foreground">{lesson.summary}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {lesson.isFreePreview && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Grátis</span>
          )}
          {lesson.durationMinutes ? (
            <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {lesson.durationMinutes} min
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
