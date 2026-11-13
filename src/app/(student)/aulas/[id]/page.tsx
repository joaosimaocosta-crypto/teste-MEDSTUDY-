import { ChevronLeft, ChevronRight, Clock, ExternalLink, FileText, Link2, Lock, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Markdown } from "@/components/content/markdown";
import { VideoEmbed } from "@/components/content/video-embed";
import { StudentCrumbs } from "@/components/features/catalog/crumbs";
import { CompleteLessonButton, LessonViewTracker } from "@/components/features/catalog/lesson-progress";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/lib/auth/routes";
import { getLesson } from "@/lib/services/catalog";
import { RESOURCE_TYPES } from "@/lib/validations/content";

export const metadata: Metadata = { title: "Aula" };

type Params = PageProps<"/aulas/[id]">["params"];

export default function LessonPage({ params }: PageProps<"/aulas/[id]">) {
  return (
    <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-card bg-muted" aria-label="A carregar a aula" />}>
      <LessonContent params={params} />
    </Suspense>
  );
}

async function LessonContent({ params }: { params: Params }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const data = await getLesson(id);
  if (!data) notFound();
  const { ctx, lesson, resources } = data;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <StudentCrumbs
        items={[
          { href: "/cursos", label: "Cursos" },
          { href: `/cursos/${ctx.course_slug}`, label: ctx.course_title },
          { href: `/cursos/${ctx.course_slug}/${ctx.subject_slug}`, label: ctx.subject_title },
        ]}
      />

      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {ctx.module_title} · {ctx.chapter_title}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ctx.lesson_title}</h1>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Aula {ctx.position_in_subject} de {ctx.total_in_subject}
          </span>
          {ctx.duration_minutes ? (
            <span className="flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> {ctx.duration_minutes} min
            </span>
          ) : null}
          {ctx.is_free_preview && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              Aula gratuita
            </span>
          )}
        </p>
      </header>

      {ctx.is_locked || !lesson ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Lock className="size-7" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Aula exclusiva para assinantes</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {ctx.lesson_summary ?? "Active a sua assinatura para aceder a esta aula, aos manuais e aos testes."}
          </p>
          <Link href={ROUTES.subscription} className={buttonClasses({ size: "lg" })}>
            Ver planos de assinatura
          </Link>
        </Card>
      ) : (
        <>
          <LessonViewTracker lessonId={ctx.lesson_id} />
          {lesson.video_url && <VideoEmbed url={lesson.video_url} title={ctx.lesson_title} />}

          <Card className="p-5 sm:p-8">
            {lesson.content ? (
              <Markdown>{lesson.content}</Markdown>
            ) : (
              <p className="text-muted-foreground">Esta aula ainda não tem texto.</p>
            )}
          </Card>

          {resources.length > 0 && (
            <Card>
              <CardHeader title="Recursos" />
              <ul className="flex flex-col gap-2">
                {resources.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-muted"
                    >
                      {r.type === "pdf" || r.type === "document" ? (
                        <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                      ) : r.type === "video" ? (
                        <PlayCircle className="size-5 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <Link2 className="size-5 shrink-0 text-primary" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {RESOURCE_TYPES[r.type as keyof typeof RESOURCE_TYPES] ?? r.type}
                        </span>
                      </span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <CompleteLessonButton lessonId={ctx.lesson_id} initialCompleted={ctx.is_completed} />
        </>
      )}

      <nav aria-label="Navegação entre aulas" className="grid grid-cols-2 gap-3">
        {ctx.prev_lesson_id ? (
          <Link href={`/aulas/${ctx.prev_lesson_id}`} className={buttonClasses({ variant: "secondary" })}>
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </Link>
        ) : (
          <span />
        )}
        {ctx.next_lesson_id ? (
          <Link href={`/aulas/${ctx.next_lesson_id}`} className={buttonClasses({ variant: "secondary" })}>
            Seguinte <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <Link href={`/cursos/${ctx.course_slug}/${ctx.subject_slug}`} className={buttonClasses({ variant: "secondary" })}>
            Voltar ao índice
          </Link>
        )}
      </nav>
    </article>
  );
}
