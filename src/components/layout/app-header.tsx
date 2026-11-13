import { SignOutButton } from "@/components/layout/sign-out-button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ROUTES } from "@/lib/auth/routes";

/** Cabeçalho simples (usado pela área administrativa até à Fase 5). */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo href={ROUTES.dashboard} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton compact />
        </div>
      </div>
    </header>
  );
}
