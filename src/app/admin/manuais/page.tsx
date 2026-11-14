import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PUBLICATION_STATUS } from "@/lib/content/levels";
import { shortDate } from "@/lib/format";
import { getCourseOptions, listManualsForAdmin } from "@/lib/services/manuals";

export const metadata: Metadata = { title: "Manuais · Administração" };

export default function AdminManualsPage({ searchParams }: PageProps<"/admin/manuais">) {
  return (
    <AdminOnly>
      <PageHeader
        title="Manuais"
        description="Manuais oficiais em PDF (ficheiros alojados na Lunes Host)."
        action={
          <Link href="/admin/manuais/novo" className={buttonClasses({ size: "sm" })}>
            <Plus className="size-4" aria-hidden /> Novo manual
          </Link>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <ManualsList searchParams={searchParams} />
      </Suspense>
    </AdminOnly>
  );
}

const selectCls =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:w-auto";

async function ManualsList({ searchParams }: { searchParams: PageProps<"/admin/manuais">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const filters = { q: one("q").slice(0, 80), course: one("curso") || null, subject: null, status: one("estado") || null };
  const [manuals, { courses }] = await Promise.all([listManualsForAdmin(filters), getCourseOptions()]);

  return (
    <div className="flex flex-col gap-4">
      <form method="get" role="search" className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Pesquisar pelo nome"
          aria-label="Pesquisar pelo nome"
          className="h-11 rounded-xl border border-border bg-card px-3 text-base focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:min-w-64 sm:flex-1 sm:text-sm"
        />
        <select name="curso" defaultValue={filters.course ?? ""} aria-label="Curso" className={selectCls}>
          <option value="">Todos os cursos</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={filters.status ?? ""} aria-label="Estado" className={selectCls}>
          <option value="">Todos os estados</option>
          <option value="published">Publicados</option>
          <option value="draft">Rascunhos</option>
          <option value="archived">Arquivados</option>
        </select>
        <button type="submit" className={buttonClasses({ size: "sm", className: "h-11" })}>
          Filtrar
        </button>
      </form>

      <Card className="p-0 sm:p-0">
        {manuals.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum manual encontrado" />
        ) : (
          <ul className="divide-y divide-border">
            {manuals.map((m) => {
              const st = PUBLICATION_STATUS[m.status];
              return (
                <li key={m.id}>
                  <Link href={`/admin/manuais/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted sm:px-5">
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.course?.title}
                        {m.subject ? ` · ${m.subject.title}` : ""}
                        {m.published_at ? ` · publicado em ${shortDate(m.published_at)}` : ""}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
