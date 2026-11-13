import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SubmitButton } from "@/components/ui/submit-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";

/** Cabeçalho das áreas autenticadas (provisório — redesenhado na Fase 4). */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo href={ROUTES.dashboard} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={signOut}>
            <SubmitButton variant="secondary" size="sm" pendingText="A sair…" aria-label="Sair da conta">
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sair</span>
            </SubmitButton>
          </form>
        </div>
      </div>
    </header>
  );
}
