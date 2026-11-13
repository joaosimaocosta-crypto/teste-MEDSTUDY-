import { ChevronRight, FileText, Lock, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/lib/auth/routes";
import { shortDate } from "@/lib/format";
import { listManualsForStudent } from "@/lib/services/manuals";

export const metadata: Metadata = { title: "Manuais" };

export default function ManualsPage({ searchParams }: PageProps<"/manuais">) {
  return (
    <>
      <PageHeader title="Manuais" description="Biblioteca de manuais oficiais em PDF." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const selectCls =
  "h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:w-auto";
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Library({ searchParams }: { searchParams: PageProps<"/manuais">["searchParams"] }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const course = guid.test(one("curso")) ? one("curso") : null;
  const subject = guid.test(one("disciplina")) ? one("disciplina") : null;
  const q = one("q").slice(0, 80);
  const { manuals, courses, subjects } = await listManualsForStudent({ q, course, subject });
  const anyLocked = manuals.some((m) => m.isLocked);
  const hasFilters = Boolean(q || course || subject);

  return (
    <div className="flex flex-col gap-4">
      <form method="get" role="search" className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <label className="relative sm:min-w-64 sm:flex-1">
          <span className="sr-only">Pesquisar manuais</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Pesquisar manuais"
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-base focus:border-primary focus:outline-none focus:ring-3 focus:ring-ring/25 sm:text-sm"
          />
        </label>
        {courses.length > 1 && (
          <select name="curso" defaultValue={course ?? ""} aria-label="Curso" className={selectCls}>
            <option value="">Todos os cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
        <select name="disciplina" defaultValue={subject ?? ""} aria-label="Disciplina" className={selectCls}>
          <option value="">Todas as disciplinas</option>
          {subjects
            .filter((s) => !course || s.course_id === course)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses({ size: "sm", className: "h-11 flex-1 sm:flex-none" })}>
            Filtrar
          </button>
          {hasFilters && (
            <Link href={ROUTES.manuals} className={buttonClasses({ variant: "ghost", size: "sm", className: "h-11" })}>
              Limpar
            </Link>
          )}
        </div>
      </form>

      {anyLocked && (
        <div className="flex flex-col gap-3 rounded-card border border-primary/25 bg-accent p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm">
            <Lock className="size-4 shrink-0" aria-hidden />
            Os manuais estão disponíveis para estudantes com assinatura activa.
          </p>
          <Link href={ROUTES.subscription} className={buttonClasses({ size: "sm", className: "shrink-0" })}>
            Ver planos
          </Link>
        </div>
      )}

      {manuals.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={hasFilters ? "Nenhum manual encontrado" : "Ainda não há manuais publicados"}
            description={hasFilters ? "Experimente outros termos ou filtros." : undefined}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {manuals.map((m) => (
            <li key={m.id}>
              <Link
                href={`/manuais/${m.id}`}
                className="flex h-full items-start gap-3 rounded-card border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  {m.isLocked ? <Lock className="size-5" aria-label="Requer assinatura" /> : <FileText className="size-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.title}</p>
                  {m.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {m.subject?.title ?? m.course?.title}
                    {m.page_count ? ` · ${m.page_count} páginas` : ""}
                    {m.published_at ? ` · ${shortDate(m.published_at)}` : ""}
                  </p>
                </div>
                <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
