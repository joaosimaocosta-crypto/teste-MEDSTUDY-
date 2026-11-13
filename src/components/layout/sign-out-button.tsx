import { LogOut } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** Botão "Sair" (formulário com Server Action — funciona mesmo sem JavaScript). */
export function SignOutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <form action={signOut} className={className}>
      <SubmitButton
        variant={compact ? "secondary" : "ghost"}
        size="sm"
        pendingText={compact ? "" : "A sair…"}
        aria-label="Sair da conta"
        className={cn(!compact && "w-full justify-start px-3 text-muted-foreground")}
      >
        <LogOut className="size-4" aria-hidden />
        <span className={cn(compact && "sr-only")}>Sair</span>
      </SubmitButton>
    </form>
  );
}
