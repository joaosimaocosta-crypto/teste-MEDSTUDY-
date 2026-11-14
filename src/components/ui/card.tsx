import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cartão base usado em todo o painel. */
export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-card border border-border bg-card p-4 shadow-sm sm:p-5", className)}
      {...props}
    />
  );
}

/** Cabeçalho de cartão: título, subtítulo opcional e acção à direita. */
export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
