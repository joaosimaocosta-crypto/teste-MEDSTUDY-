import type { ReactNode } from "react";
import { BottomNav, SidebarNav } from "@/components/layout/nav-links";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ROUTES } from "@/lib/auth/routes";

/**
 * Estrutura da área do estudante.
 *  - Telemóvel/tablet: cabeçalho no topo + barra de navegação inferior.
 *  - Computador (lg ≥ 1024px): barra lateral fixa à esquerda.
 * Não lê a sessão (fica no "static shell" e aparece instantaneamente).
 */
export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Barra lateral — computador */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-card px-4 py-5 lg:flex">
        <Logo href={ROUTES.dashboard} className="px-1" />
        <SidebarNav />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
          <SignOutButton className="flex-1" />
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Cabeçalho — telemóvel/tablet */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Logo href={ROUTES.dashboard} />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <SignOutButton compact />
            </div>
          </div>
        </header>

        {/* pb-24: espaço para a barra inferior no telemóvel */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
