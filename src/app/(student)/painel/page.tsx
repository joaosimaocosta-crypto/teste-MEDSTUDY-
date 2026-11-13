import { CreditCard, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel" };

/** Painel do estudante — versão provisória da Fase 3 (o dashboard completo chega na Fase 4). */
export default function DashboardPage({ searchParams }: PageProps<"/painel">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/painel">["searchParams"] }) {
  const user = await requireUser(ROUTES.dashboard);
  const { senha } = await searchParams;

  const supabase = await createClient();
  const { data: hasSubscription } = await supabase.rpc("has_active_subscription");

  return (
    <>
      {senha === "alterada" && <Alert variant="success">A sua senha foi alterada com sucesso.</Alert>}

      <section>
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{user.fullName || "Estudante"}</h1>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCard icon={UserRound} title="Conta" text={user.email ?? "—"} />
        <InfoCard
          icon={CreditCard}
          title="Assinatura"
          text={hasSubscription ? "Activa" : "Sem assinatura activa"}
        />
      </section>

      {user.role === "admin" && (
        <Link href={ROUTES.admin} className={buttonClasses({ variant: "secondary", className: "self-start" })}>
          <ShieldCheck className="size-4" aria-hidden />
          Painel administrativo
        </Link>
      )}
    </>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof UserRound; title: string; text: string }) {
  return (
    <article className="flex items-center gap-4 rounded-card border border-border bg-card p-5 shadow-sm">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm text-muted-foreground">{title}</h2>
        <p className="truncate font-semibold">{text}</p>
      </div>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-label="A carregar">
      <div className="h-12 w-56 rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-24 rounded-card bg-muted" />
        <div className="h-24 rounded-card bg-muted" />
      </div>
    </div>
  );
}
