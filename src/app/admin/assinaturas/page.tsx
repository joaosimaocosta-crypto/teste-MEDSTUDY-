import { CreditCard, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { SubscriptionActions } from "@/components/features/subscriptions/admin-forms";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatMZN, shortDate } from "@/lib/format";
import { listSubscriptionsForAdmin, type SubscriptionFilter } from "@/lib/services/subscriptions";
import { SUBSCRIPTION_STATUS } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assinaturas · Administração" };

const FILTERS: { key: SubscriptionFilter; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "active", label: "Activas" },
  { key: "expiring", label: "A expirar (7 dias)" },
  { key: "expired", label: "Expiradas" },
  { key: "suspended", label: "Suspensas" },
  { key: "all", label: "Todas" },
];

export default function AdminSubscriptionsPage({ searchParams }: PageProps<"/admin/assinaturas">) {
  return (
    <AdminOnly>
      <PageHeader title="Assinaturas" description="Active pedidos, renove, suspenda e acompanhe as validades." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <Subscriptions searchParams={searchParams} />
      </Suspense>
    </AdminOnly>
  );
}

async function Subscriptions({ searchParams }: { searchParams: PageProps<"/admin/assinaturas">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const filter = (FILTERS.find((f) => f.key === one("estado"))?.key ?? "pending") as SubscriptionFilter;
  const q = one("q").slice(0, 80);
  const { rows, counts } = await listSubscriptionsForAdmin(filter, q);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Filtrar por estado" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const n = f.key === "pending" ? counts.pending : f.key === "suspended" ? counts.suspended : f.key === "expiring" ? counts.expiring : null;
          return (
            <Link
              key={f.key}
              href={`/admin/assinaturas?estado=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={f.key === filter ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap",
                f.key === filter ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
              {n ? <span className="rounded-full bg-card px-1.5 text-xs tabular-nums">{n}</span> : null}
            </Link>
          );
        })}
      </nav>

      <form method="get" role="search" className="flex gap-2">
        <input type="hidden" name="estado" value={filter} />
        <label className="relative flex-1">
          <span className="sr-only">Pesquisar estudante</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nome ou e-mail do estudante"
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-base focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:text-sm"
          />
        </label>
        <button type="submit" className={buttonClasses({ size: "sm", className: "h-11" })}>
          Pesquisar
        </button>
      </form>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={CreditCard} title="Nenhuma assinatura neste filtro" />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((s) => {
            const st = SUBSCRIPTION_STATUS[s.effective];
            return (
              <li key={s.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/admin/estudantes/${s.student?.id}`} className="font-semibold hover:text-primary">
                        {s.student?.full_name || "Sem nome"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{s.student?.email}</p>
                      <p className="mt-1 text-sm">
                        {s.plan?.name} · {s.plan ? formatMZN(Number(s.plan.price_mzn)) : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.starts_at && s.expires_at ? `${shortDate(s.starts_at)} → ${shortDate(s.expires_at)}` : `Pedido em ${shortDate(s.created_at)}`}
                      </p>
                      {s.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">Notas: {s.notes}</p>}
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <SubscriptionActions id={s.id} status={s.effective} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
