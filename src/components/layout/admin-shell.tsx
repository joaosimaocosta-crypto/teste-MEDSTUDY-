import { ArrowLeftRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollTabsNav, SidebarNav } from "@/components/layout/nav-links";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ROUTES } from "@/lib/auth/routes";

/**
 * Estrutura da área administrativa.
 *  - Computador: barra lateral com todas as secções.
 *  - Telemóvel/tablet: cabeçalho + separadores deslizantes.
 * Não verifica permissões (cada página/acção chama requireAdmin() no servidor).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const studentLink = (
    <Link
      href={ROUTES.dashboard}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <ArrowLeftRight className="size-5" aria-hidden />
      Área do estudante
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto border-r border-border bg-card px-4 py-5 lg:flex">
        <div className="flex flex-col gap-2 px-1">
          <Logo href={ROUTES.admin} />
          <AdminBadge />
        </div>
        <SidebarNav section="admin" />
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
          {studentLink}
          <div className="flex items-center justify-between gap-2">
            <SignOutButton className="flex-1" />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <Logo href={ROUTES.admin} />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <SignOutButton compact />
            </div>
          </div>
          <ScrollTabsNav section="admin" />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}

function AdminBadge() {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary/12 px-2.5 py-1 text-xs font-semibold text-foreground">
      <ShieldCheck className="size-3.5 text-secondary" aria-hidden />
      Administração
    </span>
  );
}
