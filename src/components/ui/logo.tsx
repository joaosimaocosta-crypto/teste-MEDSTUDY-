import { Stethoscope } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logótipo MEDSTUDY MOZ (ícone + nome), com link opcional. */
export function Logo({ href = "/", className }: { href?: string | null; className?: string }) {
  const content = (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Stethoscope className="size-5" aria-hidden />
      </span>
      <span className="text-lg font-bold tracking-tight">
        MEDSTUDY <span className="text-primary">MOZ</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="MEDSTUDY MOZ — página inicial">
      {content}
    </Link>
  ) : (
    content
  );
}
