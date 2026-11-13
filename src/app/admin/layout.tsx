import { AppHeader } from "@/components/layout/app-header";

/**
 * Layout da área administrativa.
 * A protecção é feita em cada página/acção com requireAdmin() — o proxy apenas
 * garante que há sessão; o papel "admin" é sempre verificado no servidor.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
