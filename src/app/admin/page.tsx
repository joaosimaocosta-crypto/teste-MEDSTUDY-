import { ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administração" };

/** Entrada do painel administrativo — versão provisória da Fase 3 (completo na Fase 5). */
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const admin = await requireAdmin();

  const supabase = await createClient();
  // RLS: só um administrador consegue contar todos os perfis.
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground">Sessão de {admin.fullName || admin.email}</p>
        </div>
      </section>

      <article className="flex items-center gap-4 rounded-card border border-border bg-card p-5 shadow-sm">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Users className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm text-muted-foreground">Estudantes registados</h2>
          <p className="text-2xl font-bold">{count ?? 0}</p>
        </div>
      </article>
    </div>
  );
}
