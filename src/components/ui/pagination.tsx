import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** Paginação simples por links (funciona sem JavaScript e mantém os filtros no URL). */
export function Pagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams({ ...params, pagina: String(p) });
    for (const [k, v] of [...qs.entries()]) if (!v) qs.delete(k);
    return `${basePath}?${qs.toString()}`;
  };

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <ChevronLeft className="size-4" aria-hidden /> Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Seguinte <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
