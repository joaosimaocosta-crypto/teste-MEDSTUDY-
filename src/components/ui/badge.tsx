import { CircleAlert, CircleCheck, CircleX, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Etiqueta de estado. Cores de estado acompanham SEMPRE um ícone e um texto
 * (nunca só a cor), para quem não distingue cores.
 */
const tones = {
  success: { cls: "bg-success/12 text-foreground", Icon: CircleCheck, icon: "text-success" },
  warning: { cls: "bg-warning/15 text-foreground", Icon: Clock, icon: "text-warning" },
  danger: { cls: "bg-danger/12 text-foreground", Icon: CircleX, icon: "text-danger" },
  neutral: { cls: "bg-muted text-muted-foreground", Icon: CircleAlert, icon: "text-muted-foreground" },
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  const { cls, Icon, icon } = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        cls,
        className,
      )}
    >
      <Icon className={cn("size-3.5", icon)} aria-hidden />
      {children}
    </span>
  );
}
