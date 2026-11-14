import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const styles = {
  error: { box: "border-danger/30 bg-danger/10 text-danger", Icon: CircleAlert },
  success: { box: "border-success/30 bg-success/10 text-success", Icon: CircleCheck },
  info: { box: "border-secondary/30 bg-secondary/10 text-secondary", Icon: Info },
} as const;

/** Caixa de mensagem (erro, sucesso, informação). */
export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: keyof typeof styles;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-foreground">{children}</div>
    </div>
  );
}
