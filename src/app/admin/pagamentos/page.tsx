import { ReceiptText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { PaymentForm } from "@/components/features/subscriptions/admin-forms";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMZN, shortDate } from "@/lib/format";
import { listPaymentsForAdmin } from "@/lib/services/subscriptions";
import { PAYMENT_METHODS } from "@/lib/validations/subscriptions";
import { voidPayment } from "./actions";

export const metadata: Metadata = { title: "Pagamentos · Administração" };

const STATUS = {
  confirmed: { label: "Confirmado", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  rejected: { label: "Anulado", tone: "neutral" },
} as const;

export default function AdminPaymentsPage({ searchParams }: PageProps<"/admin/pagamentos">) {
  return (
    <AdminOnly>
      <PageHeader title="Pagamentos" description="Pagamentos registados manualmente (M-Pesa, e-Mola, transferência…)." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <Payments searchParams={searchParams} />
      </Suspense>
    </AdminOnly>
  );
}

const selectCls =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:w-auto";

async function Payments({ searchParams }: { searchParams: PageProps<"/admin/pagamentos">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const methodParam = one("metodo");
  const method = methodParam in PAYMENT_METHODS ? methodParam : null;
  const { rows, plans, total, currentMonth } = await listPaymentsForAdmin({ month: one("mes") || null, method, q: one("q") });
  const month = one("mes") || "";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
      <div className="flex flex-col gap-4 lg:col-span-3">
        <form method="get" role="search" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <label className="relative col-span-2 sm:min-w-56 sm:flex-1">
            <span className="sr-only">Pesquisar estudante</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={one("q")}
              placeholder="Nome ou e-mail"
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-base focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:text-sm"
            />
          </label>
          <input type="month" name="mes" defaultValue={month} aria-label="Mês" max={currentMonth} className={selectCls} />
          <select name="metodo" defaultValue={method ?? ""} aria-label="Método" className={selectCls}>
            <option value="">Todos os métodos</option>
            {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClasses({ size: "sm", className: "col-span-2 h-11 sm:col-span-1" })}>
            Filtrar
          </button>
        </form>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {rows.length} {rows.length === 1 ? "pagamento" : "pagamentos"} · total confirmado <strong className="text-foreground">{formatMZN(total)}</strong>
        </p>

        <Card className="p-0 sm:p-0">
          {rows.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Nenhum pagamento encontrado" />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((p) => {
                const st = STATUS[p.status];
                return (
                  <li key={p.id} className="flex flex-col gap-1 px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums">{formatMZN(Number(p.amount_mzn))}</p>
                        <Link href={`/admin/estudantes/${p.student?.id}`} className="block truncate text-sm hover:text-primary">
                          {p.student?.full_name || p.student?.email}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {PAYMENT_METHODS[p.method]} · {shortDate(p.paid_at ?? p.created_at)}
                          {p.reference ? ` · Ref. ${p.reference}` : ""} · {p.plan?.name ?? "—"}
                          {p.recorder?.full_name ? ` · registado por ${p.recorder.full_name}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {p.status === "confirmed" && (
                          <form action={voidPayment}>
                            <input type="hidden" name="id" value={p.id} />
                            <SubmitButton size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" pendingText="…">
                              Anular
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="self-start lg:col-span-2">
        <CardHeader title="Registar pagamento" />
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crie primeiro um plano.</p>
        ) : (
          <PaymentForm plans={plans.map((p) => ({ ...p, price_mzn: Number(p.price_mzn) }))} defaultEmail={one("email")} />
        )}
      </Card>
    </div>
  );
}
