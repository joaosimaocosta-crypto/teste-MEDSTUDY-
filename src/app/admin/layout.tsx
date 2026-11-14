import { AdminShell } from "@/components/layout/admin-shell";

/**
 * Layout da área administrativa (apenas a estrutura visual: menu e cabeçalho).
 *
 * ⚠️ Um layout NÃO protege as páginas (cada segmento é renderizado à parte).
 * Protecção em camadas:
 *  1. proxy.ts — sem sessão → /entrar
 *  2. <AdminOnly> em CADA page.tsx — nada é enviado antes de requireAdmin()
 *  3. Cada consulta/acção chama requireAdmin() e a BD aplica RLS.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
