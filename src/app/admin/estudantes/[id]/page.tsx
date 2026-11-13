import { ArrowLeft, BookOpen, ClipboardCheck, CreditCard, Mail, Phone, ReceiptText, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AdminOnly } from "@/components/auth/admin-only";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMZN, shortDate, shortDateTime } from "@/lib/format";
import { getStudentDetail } from "@/lib/services/admin";
import { SUBSCRIPTION_STATUS } from "@/lib/subscriptions";
import { RoleControl } from "../role-control";

export const metadata: Metadata = { title: "Ficha do estudante · Administração" };

const PAYMENT_METHOD: Record<string, string> = {
  mpesa: "M-Pesa",
  emola: "e-Mola",
  mkesh: "mKesh",
  bank_transfer: "Transferência bancária",
  cash: "Numerário",
  other: "Outro",
};
const PAYMENT_STATUS = {
  confirmed: { label: "Confirmado", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  rejected: { label: "Rejeitado", tone: "danger" },
} as const;

export default function StudentDetailPage({ params }: PageProps<"/admin/estudantes/[id]">) {
  return (
    <AdminOnly>
      <Link
        href="/admin/estudantes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Estudantes
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <StudentDetail params={params} />
      </Suspense>
    </AdminOnly>
  );
}

async function StudentDetail({ params }: { params: PageProps<"/admin/estudantes/[id]">["params"] }) {
  const { id } = await params;
  // Validar o parâmetro do URL antes de o enviar para a base de dados.
  if (!z.uuid().safeParse(id).success) notFound();

  const [detail, me] = await Promise.all([getStudentDetail(id), getCurrentUser()]);
  if (!detail) notFound();

  const { profile, subscriptions, payments, attempts, summary } = detail;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{profile.full_name || "Sem nome"}</h1>
        {profile.role === "admin" ? <Badge tone="neutral">Administrador</Badge> : <Badge tone="neutral">Estudante</Badge>}
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={BookOpen} label="Aulas concluídas" value={String(summary.lessonsCompleted)} />
        <StatTile icon={ClipboardCheck} label="Testes realizados" value={String(summary.quizzesTaken)} />
        <StatTile icon={Target} label="Média nos testes" value={summary.averageScore === null ? "—" : `${summary.averageScore}%`} />
        <StatTile
          icon={CreditCard}
          label="Última actividade"
          value={summary.lastActivity ? shortDate(summary.lastActivity) : "—"}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Dados pessoais" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Field label="E-mail" icon={Mail} value={profile.email} />
            <Field label="Telefone" icon={Phone} value={profile.phone} />
            <Field label="Província" value={profile.province} />
            <Field label="Instituição" value={profile.institution} />
            <Field label="Ano do curso" value={profile.academic_year ? `${profile.academic_year}.º ano` : null} />
            <Field label="Registado em" value={shortDateTime(profile.created_at)} />
          </dl>
        </Card>

        <Card className="self-start">
          <CardHeader title="Papel na plataforma" />
          <RoleControl
            userId={profile.id}
            currentRole={profile.role}
            isSelf={me?.id === profile.id}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Assinaturas" description="A gestão (activar, suspender, renovar) chega na Fase 10." />
        {subscriptions.length === 0 ? (
          <EmptyState icon={CreditCard} title="Sem assinaturas" />
        ) : (
          <ul className="divide-y divide-border">
            {subscriptions.map((s) => {
              const st = SUBSCRIPTION_STATUS[s.effective];
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{s.plan?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.starts_at && s.expires_at
                        ? `${shortDate(s.starts_at)} → ${shortDate(s.expires_at)}`
                        : `Pedido em ${shortDate(s.created_at)}`}
                    </p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader title="Pagamentos" />
          {payments.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Sem pagamentos registados" />
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => {
                const st = PAYMENT_STATUS[p.status];
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">{formatMZN(Number(p.amount_mzn))}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {PAYMENT_METHOD[p.method] ?? p.method}
                        {p.reference ? ` · Ref. ${p.reference}` : ""} · {shortDate(p.paid_at ?? p.created_at)}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Histórico de testes" />
          {attempts.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Ainda não realizou testes" />
          ) : (
            <ul className="divide-y divide-border">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.quiz?.title ?? "Teste"}</p>
                    <p className="text-xs text-muted-foreground">{a.submitted_at ? shortDateTime(a.submitted_at) : "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{Math.round(Number(a.percentage))}%</span>
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
      </div>
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string | null; icon?: typeof Mail }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 truncate font-medium">
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="truncate">{value || "—"}</span>
      </dd>
    </div>
  );
}
