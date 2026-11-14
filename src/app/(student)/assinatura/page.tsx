import { CalendarClock, CreditCard, LifeBuoy, ReceiptText, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Markdown } from "@/components/content/markdown";
import { PlanCard } from "@/components/features/subscriptions/student-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMZN, shortDate } from "@/lib/format";
import { getMySubscriptionPage } from "@/lib/services/subscriptions";
import { SUBSCRIPTION_STATUS } from "@/lib/subscriptions";
import { PAYMENT_METHODS } from "@/lib/validations/subscriptions";
import { cancelRequest } from "./actions";

export const metadata: Metadata = { title: "Assinatura" };

export default function SubscriptionPage() {
  return (
    <>
      <PageHeader title="Assinatura" description="O seu plano, pagamentos e acesso aos conteúdos." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <SubscriptionContent />
      </Suspense>
    </>
  );
}

const PAYMENT_STATUS = {
  confirmed: { label: "Confirmado", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  rejected: { label: "Anulado", tone: "neutral" },
} as const;

async function SubscriptionContent() {
  const { plans, current, pending, subscriptions, payments, settings } = await getMySubscriptionPage();
  const isActive = current?.effective === "active";

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {/* Estado actual */}
      <Card>
        <CardHeader title="Estado actual" action={<CreditCard className="size-5 text-muted-foreground" aria-hidden />} />
        {!current ? (
          <p className="text-sm text-muted-foreground">Ainda não tem nenhuma assinatura. Escolha um plano abaixo.</p>
        ) : current.id === pending?.id ? null : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{current.plan?.name ?? "Plano"}</p>
              <Badge tone={SUBSCRIPTION_STATUS[current.effective].tone}>{SUBSCRIPTION_STATUS[current.effective].label}</Badge>
            </div>
            {isActive && current.expires_at && (
              <p className="flex items-center gap-2 text-sm">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                Válida até <strong>{shortDate(current.expires_at)}</strong>
                {current.daysLeft !== null && <span className="text-muted-foreground">({current.daysLeft} {current.daysLeft === 1 ? "dia" : "dias"} restantes)</span>}
              </p>
            )}
            {current.effective === "expired" && <p className="text-sm text-muted-foreground">A sua assinatura expirou. Escolha um plano para renovar.</p>}
            {current.effective === "suspended" && (
              <p className="text-sm text-muted-foreground">A sua assinatura está suspensa. Contacte o suporte para mais informações.</p>
            )}
          </div>
        )}

        {pending && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">Pedido pendente</Badge>
              <p className="text-sm font-medium">
                {pending.plan?.name} — {pending.plan ? formatMZN(Number(pending.plan.price_mzn)) : ""}
              </p>
            </div>
            <p className="text-sm">
              Pedido enviado em {shortDate(pending.created_at)}. Assim que o pagamento for confirmado, o acesso fica activo
              {isActive ? " (a partir do fim da assinatura actual)" : ""}.
            </p>
            {pending.notes && <p className="text-xs text-muted-foreground">A sua referência: {pending.notes}</p>}
            <form action={cancelRequest}>
              <input type="hidden" name="id" value={pending.id} />
              <SubmitButton size="sm" variant="ghost" pendingText="A cancelar…">
                Cancelar pedido
              </SubmitButton>
            </form>
          </div>
        )}
      </Card>

      {/* Como pagar */}
      <Card>
        <CardHeader title="Como pagar" action={<Wallet className="size-5 text-muted-foreground" aria-hidden />} />
        {settings.payment_instructions ? (
          <Markdown>{settings.payment_instructions}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">As instruções de pagamento serão publicadas em breve.</p>
        )}
        {settings.support_contact && (
          <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm">
            <LifeBuoy className="size-4 text-muted-foreground" aria-hidden />
            Suporte: <strong>{settings.support_contact}</strong>
          </p>
        )}
      </Card>

      {/* Planos */}
      <section aria-labelledby="planos" className="flex flex-col gap-3">
        <h2 id="planos" className="text-lg font-semibold">
          {isActive ? "Renovar ou mudar de plano" : "Planos disponíveis"}
        </h2>
        {plans.length === 0 ? (
          <Card>
            <EmptyState icon={CreditCard} title="Ainda não há planos disponíveis" />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={{ ...p, price_mzn: Number(p.price_mzn), features: p.features ?? [] }}
                disabled={pending ? "Já tem um pedido pendente." : null}
              />
            ))}
          </div>
        )}
      </section>

      {/* Histórico */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader title="Histórico de assinaturas" />
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {subscriptions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.plan?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.starts_at && s.expires_at ? `${shortDate(s.starts_at)} → ${shortDate(s.expires_at)}` : `Pedido em ${shortDate(s.created_at)}`}
                    </p>
                  </div>
                  <Badge tone={SUBSCRIPTION_STATUS[s.effective].tone}>{SUBSCRIPTION_STATUS[s.effective].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Pagamentos" action={<ReceiptText className="size-5 text-muted-foreground" aria-hidden />} />
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há pagamentos registados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((p) => {
                const st = PAYMENT_STATUS[p.status];
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">{formatMZN(Number(p.amount_mzn))}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {PAYMENT_METHODS[p.method]} · {shortDate(p.paid_at ?? p.created_at)}
                        {p.reference ? ` · Ref. ${p.reference}` : ""}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
