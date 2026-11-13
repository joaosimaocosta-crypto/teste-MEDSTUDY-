import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Layout das páginas de autenticação (entrar, registar, recuperar senha).
 * A pasta "(auth)" é um grupo de rotas: organiza ficheiros sem aparecer no URL.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:items-center sm:pt-0">
        <div className="w-full max-w-md rounded-card border border-border bg-card p-5 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
