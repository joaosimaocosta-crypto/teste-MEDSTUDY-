import {
  AlarmClock,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileText,
  Hourglass,
  PlayCircle,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { ColumnChart } from "@/components/charts/column-chart";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { formatMZN, formatNumber, shortDate } from "@/lib/format";
import { getAdminOverview } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Administração" };

export default function AdminOverviewPage() {
  return (
    <AdminOnly>
      <PageHeader title="Visão geral" description="Indicadores da plataforma MEDSTUDY MOZ." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <Overview />
      </Suspense>
    </AdminOnly>
  );
}

async function Overview() {
  const data = await getAdminOverview();
  const { stats, content } = data;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <section aria-label="Estudantes e assinaturas" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Estudantes"
          value={formatNumber(stats.students)}
          note={`+${stats.newStudents30} nos últimos 30 dias`}
        />
        <StatTile icon={CreditCard} label="Assinaturas activas" value={formatNumber(stats.activeSubscriptions)} />
        <StatTile
          icon={Hourglass}
          label="Pedidos pendentes"
          value={formatNumber(stats.pendingSubscriptions)}
          note="A aguardar activação"
        />
        <StatTile icon={Wallet} label="Receita do mês" value={formatMZN(stats.revenueMonth)} note="Pagamentos confirmados" />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Novos registos" description="Estudantes registados por semana (últimas 8 semanas)" />
          <ColumnChart
            data={data.weeklySignups}
            unit={["registo", "registos"]}
            caption="Novos estudantes registados por semana nas últimas 8 semanas (semana que começa em)"
            emptyText="Sem novos registos nas últimas 8 semanas."
            lastLabel="Esta sem."
          />
        </Card>

        <Card>
          <CardHeader title="Atenção" />
          <ul className="flex flex-col gap-3 text-sm">
            <AttentionRow
              icon={Hourglass}
              label="Pedidos de assinatura pendentes"
              value={stats.pendingSubscriptions}
            />
            <AttentionRow icon={AlarmClock} label="Assinaturas a expirar em 7 dias" value={stats.expiringIn7} />
            <AttentionRow icon={ClipboardCheck} label="Testes realizados (30 dias)" value={stats.attempts30} />
          </ul>
        </Card>
      </div>

      <section aria-label="Conteúdos publicados" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={BookOpen} label="Cursos publicados" value={formatNumber(content.courses)} />
        <StatTile icon={PlayCircle} label="Aulas publicadas" value={formatNumber(content.lessons)} />
        <StatTile icon={FileText} label="Manuais publicados" value={formatNumber(content.manuals)} />
        <StatTile icon={ClipboardCheck} label="Testes publicados" value={formatNumber(content.quizzes)} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader title="Pedidos pendentes" description="Mais antigos primeiro" />
          {data.pendingRequests.length === 0 ? (
            <EmptyState icon={Hourglass} title="Nenhum pedido pendente" />
          ) : (
            <ul className="divide-y divide-border">
              {data.pendingRequests.map((r) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/admin/estudantes/${r.studentId}`}
                    className="flex items-center justify-between gap-3 rounded-lg hover:text-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.studentName}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.planName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{shortDate(r.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Registos recentes"
            action={
              <Link href="/admin/estudantes" className="text-sm font-medium text-primary hover:underline">
                Ver todos
              </Link>
            }
          />
          {data.recentStudents.length === 0 ? (
            <EmptyState icon={UserPlus} title="Ainda não há estudantes registados" />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentStudents.map((s) => (
                <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/admin/estudantes/${s.id}`}
                    className="flex items-center justify-between gap-3 hover:text-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.full_name || "Sem nome"}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{shortDate(s.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function AttentionRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2.5">
      <span className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{formatNumber(value)}</span>
    </li>
  );
}
