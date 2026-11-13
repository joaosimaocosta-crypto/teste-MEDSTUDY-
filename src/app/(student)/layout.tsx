import { AppHeader } from "@/components/layout/app-header";

/**
 * Layout da área do estudante. Não lê a sessão aqui (ficaria tudo à espera);
 * cada página verifica a sessão dentro de <Suspense> com requireUser().
 */
export default function StudentLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
