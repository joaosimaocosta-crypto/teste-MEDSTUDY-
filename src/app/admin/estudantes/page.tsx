import { ChevronRight, Search, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatNumber, shortDate } from "@/lib/format";
import { listStudents, type StudentListFilters } from "@/lib/services/admin";
import { SUBSCRIPTION_STATUS } from "@/lib/subscriptions";

export const metadata: Metadata = { title: "Estudantes · Administração" };

type SearchParams = PageProps<"/admin/estudantes">["searchParams"];

/** Lê e valida os filtros do URL (nunca confiar em valores livres). */
function parseFilters(sp: Record<string, string | string[] | undefined>): StudentListFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const role = one("papel");
  const sub = one("assinatura");
  const page = Number.parseInt(one("pagina"), 10);
  return {
    q: one("q").slice(0, 80),
    role: role === "admin" || role === "student" ? role : "all",
    subscription: sub === "active" || sub === "pending" ? sub : "all",
    page: Number.isFinite(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

export default function AdminStudentsPage({ searchParams }: PageProps<"/admin/estudantes">) {
  return (
    <AdminOnly>
      <PageHeader title="Estudantes" description="Consulte os utilizadores registados na plataforma." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <StudentsList searchParams={searchParams} />
      </Suspense>
    </AdminOnly>
  );
}

const selectCls =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25";

async function StudentsList({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseFilters(await searchParams);
  const { rows, total, totalPages } = await listStudents(filters);
  const hasFilters = Boolean(filters.q) || filters.role !== "all" || filters.subscription !== "all";

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros: uma linha acima dos resultados */}
      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" role="search">
        <label className="relative flex-1 sm:min-w-64">
          <span className="sr-only">Pesquisar por nome ou e-mail</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Pesquisar por nome ou e-mail"
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-base focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:[&_select]:w-auto">
          <label>
            <span className="sr-only">Papel</span>
            <select name="papel" defaultValue={filters.role === "all" ? "" : filters.role} className={selectCls}>
              <option value="">Todos os papéis</option>
              <option value="student">Estudantes</option>
              <option value="admin">Administradores</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Assinatura</span>
            <select
              name="assinatura"
              defaultValue={filters.subscription === "all" ? "" : filters.subscription}
              className={selectCls}
            >
              <option value="">Todas as assinaturas</option>
              <option value="active">Activa</option>
              <option value="pending">Pendente</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses({ size: "sm", className: "h-11" })}>
            Filtrar
          </button>
          {hasFilters && (
            <Link href="/admin/estudantes" className={buttonClasses({ variant: "ghost", size: "sm", className: "h-11" })}>
              Limpar
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {formatNumber(total)} {total === 1 ? "utilizador encontrado" : "utilizadores encontrados"}
      </p>

      <Card className="p-0 sm:p-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? "Nenhum resultado" : "Ainda não há utilizadores registados"}
            description={hasFilters ? "Experimente outros termos ou filtros." : undefined}
          />
        ) : (
          <>
            {/* Telemóvel: lista de cartões */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((r) => {
                const sub = SUBSCRIPTION_STATUS[r.subscriptionStatus];
                return (
                  <li key={r.id}>
                    <Link href={`/admin/estudantes/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {r.fullName || "Sem nome"}
                          {r.role === "admin" && <ShieldCheck className="size-4 text-secondary" aria-label="Administrador" />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                        <div className="mt-1.5">
                          <Badge tone={sub.tone}>{sub.label}</Badge>
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Computador: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Nome</th>
                    <th scope="col" className="px-5 py-3 font-medium">Província</th>
                    <th scope="col" className="px-5 py-3 font-medium">Assinatura</th>
                    <th scope="col" className="px-5 py-3 font-medium">Registo</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => {
                    const sub = SUBSCRIPTION_STATUS[r.subscriptionStatus];
                    return (
                      <tr key={r.id} className="hover:bg-muted/60">
                        <td className="px-5 py-3">
                          <p className="flex items-center gap-1.5 font-medium">
                            {r.fullName || "Sem nome"}
                            {r.role === "admin" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/12 px-2 py-0.5 text-xs font-semibold">
                                <ShieldCheck className="size-3.5 text-secondary" aria-hidden /> Admin
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.email}</p>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{r.province ?? "—"}</td>
                        <td className="px-5 py-3">
                          <Badge tone={sub.tone}>{sub.label}</Badge>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-muted-foreground">{shortDate(r.createdAt)}</td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/admin/estudantes/${r.id}`} className="font-medium text-primary hover:underline">
                            Ver ficha
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Pagination
        page={filters.page}
        totalPages={totalPages}
        basePath="/admin/estudantes"
        params={{
          q: filters.q,
          papel: filters.role === "all" ? "" : filters.role,
          assinatura: filters.subscription === "all" ? "" : filters.subscription,
        }}
      />
    </div>
  );
}
