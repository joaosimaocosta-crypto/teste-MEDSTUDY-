import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  PlayCircle,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WeeklyActivityChart } from "@/components/features/dashboard/weekly-activity-chart";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { StatTile } from "@/components/ui/stat-tile";
import { ROUTES } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";
import { longDate, shortDate } from "@/lib/format";
import { getDashboardData, type DashboardData } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Painel" };

/**
 * Dashboard do estudante.
 * A estrutura aparece de imediato (esqueleto); os dados chegam por streaming
 * dentro de <Suspense>, depois de verificada a sessão no servidor.
 */
export default function DashboardPage({ searchParams }: PageProps<"/painel">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/painel">["searchParams"] }) {
  const user = await requireUser(ROUTES.dashboard);
  const [{ senha }, data] = await Promise.all([searchParams, getDashboardData(user)]);
  const firstName = user.fullName.split(" ")[0] || "Estudante";

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {senha === "alterada" && <Alert variant="success">A sua senha foi alterada com sucesso.</Alert>}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{longDate(new Date())}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Olá, {firstName}</h1>
        </div>
        {user.role === "admin" && (
          <Link href={ROUTES.admin} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <ShieldCheck className="size-4" aria-hidden />
            Painel administrativo
          </Link>
        )}
      </header>

      <SubscriptionBanner subscription={data.subscription} />

      {/* Indicadores */}
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={BookOpen} label="Aulas concluídas" value={String(data.stats.lessonsCompleted)} />
        <StatTile icon={ClipboardCheck} label="Testes realizados" value={String(data.stats.quizzesTaken)} />
        <StatTile
          icon={Target}
          label="Média nos testes"
          value={data.stats.averageScore === null ? "—" : `${data.stats.averageScore}%`}
        />
        <StatTile
          icon={CalendarCheck}
          label="Dias de estudo"
          value={`${data.stats.studyDaysLast7}/7`}
          note="Últimos 7 dias"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Actividade da semana" description="Aulas concluídas por dia" />
          <WeeklyActivityChart data={data.weekly} />
        </Card>
        <ContinueCard lesson={data.continueLesson} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <SubjectProgress subjects={data.subjects} />
        <RecentAttempts attempts={data.recentAttempts} />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Secções
// -----------------------------------------------------------------------------

function SubscriptionBanner({ subscription }: { subscription: DashboardData["subscription"] }) {
  const { status, planName, expiresAt, daysLeft } = subscription;

  if (status === "active") {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{planName ?? "Assinatura"}</p>
            <p className="text-sm text-muted-foreground">
              Válida até {expiresAt ? shortDate(expiresAt) : "—"}
              {daysLeft !== null && ` · ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} restantes`}
            </p>
          </div>
        </div>
        <Badge tone={daysLeft !== null && daysLeft <= 5 ? "warning" : "success"}>Activa</Badge>
      </Card>
    );
  }

  const content = {
    pending: {
      badge: <Badge tone="warning">Pendente</Badge>,
      title: "Pedido de assinatura em análise",
      text: "Assim que o pagamento for confirmado, o acesso completo fica activo.",
      cta: "Ver assinatura",
    },
    expired: {
      badge: <Badge tone="danger">Expirada</Badge>,
      title: "A sua assinatura expirou",
      text: "Renove para voltar a aceder a todas as aulas, manuais e testes.",
      cta: "Renovar assinatura",
    },
    suspended: {
      badge: <Badge tone="danger">Suspensa</Badge>,
      title: "A sua assinatura está suspensa",
      text: "Contacte o suporte para mais informações.",
      cta: "Ver assinatura",
    },
    none: {
      badge: <Badge>Sem plano</Badge>,
      title: "Desbloqueie todos os conteúdos",
      text: "Aulas completas, manuais oficiais e testes com correcção — escolha um plano mensal.",
      cta: "Ver planos",
    },
  }[status];

  return (
    <section className="flex flex-col gap-3 rounded-card border border-primary/25 bg-accent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{content.title}</p>
          {content.badge}
        </div>
        <p className="text-sm text-muted-foreground">{content.text}</p>
      </div>
      <Link href={ROUTES.subscription} className={buttonClasses({ className: "shrink-0" })}>
        {content.cta}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

function ContinueCard({ lesson }: { lesson: DashboardData["continueLesson"] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="Continuar a estudar" />
      {lesson ? (
        <div className="flex flex-1 flex-col justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <PlayCircle className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">{lesson.title}</p>
              <p className="text-sm text-muted-foreground">Visto em {shortDate(lesson.lastViewedAt)}</p>
            </div>
          </div>
          <Link href={ROUTES.courses} className={buttonClasses({ fullWidth: true })}>
            Continuar
          </Link>
        </div>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="Comece a sua primeira aula"
          description="Explore as disciplinas do seu curso."
          action={
            <Link href={ROUTES.courses} className={buttonClasses({ size: "sm" })}>
              Ver cursos
            </Link>
          }
        />
      )}
    </Card>
  );
}

function SubjectProgress({ subjects }: { subjects: DashboardData["subjects"] }) {
  return (
    <Card>
      <CardHeader title="Progresso por disciplina" description="Aulas concluídas do total publicado" />
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="Ainda não há disciplinas publicadas" />
      ) : (
        <ul className="flex flex-col gap-4">
          {subjects.map((s) => (
            <li key={s.subjectId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.subjectTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.courseTitle}</p>
                </div>
                <p className="shrink-0 text-sm tabular-nums">
                  <span className="font-semibold">{s.percent}%</span>{" "}
                  <span className="text-muted-foreground">
                    ({s.completed}/{s.total})
                  </span>
                </p>
              </div>
              <Meter value={s.percent} label={`Progresso em ${s.subjectTitle}`} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentAttempts({ attempts }: { attempts: DashboardData["recentAttempts"] }) {
  return (
    <Card>
      <CardHeader
        title="Últimos testes"
        action={
          attempts.length > 0 ? (
            <Link href={ROUTES.quizzes} className="text-sm font-medium text-primary hover:underline">
              Ver todos
            </Link>
          ) : undefined
        }
      />
      {attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Ainda não fez nenhum teste"
          description="Teste os seus conhecimentos no fim de cada capítulo."
        />
      ) : (
        <ul className="divide-y divide-border">
          {attempts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.quizTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {a.submittedAt ? shortDate(a.submittedAt) : "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{a.percentage}%</span>
                {a.status === "expired" ? (
                  <Badge tone="neutral">Tempo esgotado</Badge>
                ) : a.passed ? (
                  <Badge tone="success">Aprovado</Badge>
                ) : (
                  <Badge tone="danger">Reprovado</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-label="A carregar o painel">
      <div className="h-14 w-60 rounded-lg bg-muted" />
      <div className="h-20 rounded-card bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-card bg-muted" />
        ))}
      </div>
      <div className="h-56 rounded-card bg-muted" />
    </div>
  );
}
