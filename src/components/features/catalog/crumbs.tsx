import { ChevronRight } from "lucide-react";
import Link from "next/link";

/** Caminho de navegação do estudante (Cursos › Curso › Disciplina). */
export function StudentCrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Caminho" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="max-w-48 truncate hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="max-w-48 truncate font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
