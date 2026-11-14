import { Suspense, type ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Envolve o conteúdo de UMA página de administração: nada é renderizado nem enviado
 * ao browser antes de requireAdmin() confirmar o papel no servidor.
 *
 * ⚠️ Tem de ser usado em cada página (page.tsx). Um layout NÃO protege as páginas:
 * no Next.js, cada segmento de rota é renderizado separadamente do layout.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}

function AdminSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-label="A carregar">
      <div className="h-10 w-64 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-card bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-card bg-muted" />
    </div>
  );
}
