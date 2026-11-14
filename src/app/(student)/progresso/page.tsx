import { BookOpen, CalendarCheck, ClipboardCheck, Flame, Hourglass, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityHeatmap } from "@/components/charts/activity-heatmap";
import { LineChart } from "@/components/charts/line-chart";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { ROUTES } from "@/lib/auth/routes";
import { formatMinutes } from "@/lib/progress";
import { getMyProgress } from "@/lib/services/progress";

export const metadata: Metadata = { title: "Progresso" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progresso" description="A sua evolução ao longo do curso." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <Progress />
      </Suspense>
    </>
  );
}

async function Progress() {
  const p = await getMyProgress();
  const { streaks } = p;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          icon={BookOpen}
          label="Curso concluído"
          value={`${p.totals.percent}%`}
          note={`${p.totals.completed} de ${p.totals.lessons} aulas`}
        />
        <StatTile icon={Hourglass} label="Tempo de estudo" value={formatMinutes(p.totals.minutes)} note="Duração das aulas concluídas" />
        <StatTile
          icon={Flame}
          label="Sequência actual"
          value={`${streaks.current} ${streaks.current === 1 ? "dia" : "dias"}`}
          note={streaks.studiedToday ? "Já estudou hoje" : streaks.current > 0 ? "Estude hoje para manter" : "Comece hoje"}
        />
        <StatTile
          icon={Trophy}
          label="Melhor sequência"
          value={`${streaks.best} ${streaks.best === 1 ? "dia" : "dias"}`}
          note={`${streaks.last30} dias de estudo nos últimos 30`}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-3">
          <CardHeader title="Actividade" description="Últimas 12 semanas — cada quadrado é um dia" action={<CalendarCheck className="size-5 text-muted-foreground" aria-hidden />} />
          <ActivityHeatmap columns={p.heatmap.columns} />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Testes" action={<ClipboardCheck className="size-5 text-muted-foreground" aria-hidden />} />
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-muted p-3">
              <dt className="text-xs text-muted-foreground">Realizados</dt>
              <dd className="text-xl font-semibold tabular-nums">{p.quizzes.taken}</dd>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <dt className="text-xs text-muted-foreground">Aprovados</dt>
              <dd className="text-xl font-semibold tabular-nums">{p.quizzes.passed}</dd>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <dt className="text-xs text-muted-foreground">Média</dt>
              <dd className="text-xl font-semibold tabular-nums">{p.quizzes.average === null ? "—" : `${p.quizzes.average}%`}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Evolução das notas" description="Resultado de cada tentativa (últimas 20)" action={<Target className="size-5 text-muted-foreground" aria-hidden />} />
        {p.quizzes.series.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Ainda não fez nenhum teste"
            action={
              <Link href={ROUTES.quizzes} className={buttonClasses({ size: "sm" })}>
                Ver testes
              </Link>
            }
          />
        ) : (
          <LineChart data={p.quizzes.series} />
        )}
      </Card>

      <section aria-labelledby="por-curso" className="flex flex-col gap-4">
        <h2 id="por-curso" className="text-lg font-semibold">
          Por curso e disciplina
        </h2>
        {p.courses.length === 0 ? (
          <Card>
            <EmptyState icon={BookOpen} title="Ainda não há conteúdos publicados" />
          </Card>
        ) : (
          p.courses.map((c) => {
            const pct = c.total ? Math.round((c.completed / c.total) * 100) : 0;
            return (
              <Card key={c.id}>
                <div className="mb-4 flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{c.title}</h3>
                    <p className="shrink-0 text-sm tabular-nums">
                      <span className="font-semibold">{pct}%</span>{" "}
                      <span className="text-muted-foreground">
                        ({c.completed}/{c.total})
                      </span>
                    </p>
                  </div>
                  <Meter value={pct} label={`Progresso em ${c.title}`} />
                </div>
                <ul className="flex flex-col gap-3 border-t border-border pt-4">
                  {c.subjects.map((s) => {
                    const sp = s.total_lessons ? Math.round((s.completed_lessons / s.total_lessons) * 100) : 0;
                    return (
                      <li key={s.subject_id} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">{s.subject_title}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {s.completed_lessons}/{s.total_lessons} · {formatMinutes(s.completed_minutes)}
                          </span>
                        </div>
                        <Meter value={sp} label={`Progresso em ${s.subject_title}`} />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
