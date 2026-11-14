import { ArrowRight, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudentCrumbs } from "@/components/features/catalog/crumbs";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { getCourse } from "@/lib/services/catalog";
import { SLUG_PATTERN } from "@/lib/slug";

export const metadata: Metadata = { title: "Curso" };

export default function CoursePage({ params }: PageProps<"/cursos/[courseSlug]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
      <CourseContent params={params} />
    </Suspense>
  );
}

async function CourseContent({ params }: { params: PageProps<"/cursos/[courseSlug]">["params"] }) {
  const { courseSlug } = await params;
  if (!SLUG_PATTERN.test(courseSlug)) notFound();
  const data = await getCourse(courseSlug);
  if (!data) notFound();
  const { course, subjects } = data;

  return (
    <>
      <StudentCrumbs items={[{ href: "/cursos", label: "Cursos" }, { label: course.title }]} />
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1>
        {course.description && <p className="mt-1 max-w-3xl text-muted-foreground">{course.description}</p>}
      </header>

      {subjects.length === 0 ? (
        <Card>
          <EmptyState icon={BookOpen} title="Ainda não há disciplinas publicadas neste curso" />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.id}>
              <Link
                href={`/cursos/${course.slug}/${s.slug}`}
                className="group flex h-full flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  <h2 className="font-semibold group-hover:text-primary">{s.title}</h2>
                  {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {s.completedLessons}/{s.totalLessons} aulas
                    </span>
                    <span className="font-semibold tabular-nums">{s.percent}%</span>
                  </div>
                  <Meter value={s.percent} label={`Progresso em ${s.title}`} />
                  <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-primary">
                    Ver aulas <ArrowRight className="size-4" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
