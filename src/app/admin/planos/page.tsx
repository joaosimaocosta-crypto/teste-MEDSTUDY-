import { Tags, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { PlanForm, PlanItem, SettingsForm } from "@/components/features/subscriptions/admin-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listPlansForAdmin } from "@/lib/services/subscriptions";

export const metadata: Metadata = { title: "Planos · Administração" };

export default function AdminPlansPage() {
  return (
    <AdminOnly>
      <PageHeader title="Planos" description="Planos mensais e instruções de pagamento mostradas aos estudantes." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <Plans />
      </Suspense>
    </AdminOnly>
  );
}

async function Plans() {
  const { plans, courses, settings } = await listPlansForAdmin();
  const courseTitle = (id: string | null) => courses.find((c) => c.id === id)?.title ?? null;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Planos" description={`${plans.length} ${plans.length === 1 ? "plano" : "planos"}`} action={<Tags className="size-5 text-muted-foreground" aria-hidden />} />
          {plans.length === 0 ? (
            <EmptyState icon={Tags} title="Ainda não há planos" />
          ) : (
            <ul className="flex flex-col gap-3">
              {plans.map((p) => (
                <PlanItem
                  key={p.id}
                  courses={courses}
                  subscriptionCount={p.subscriptionCount}
                  courseTitle={courseTitle(p.course_id)}
                  plan={{
                    id: p.id,
                    name: p.name,
                    description: p.description ?? "",
                    price_mzn: String(p.price_mzn),
                    duration_days: String(p.duration_days),
                    features: (p.features ?? []).join("\n"),
                    course_id: p.course_id ?? "",
                    is_active: p.is_active,
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Novo plano" />
          <PlanForm
            plan={{ name: "", description: "", price_mzn: "", duration_days: "30", features: "", course_id: "", is_active: true }}
            courses={courses}
          />
        </Card>
      </div>
      <Card className="self-start">
        <CardHeader title="Instruções de pagamento" description="Aparecem na página Assinatura de cada estudante." action={<Wallet className="size-5 text-muted-foreground" aria-hidden />} />
        <SettingsForm
          initial={{ payment_instructions: settings.payment_instructions ?? "", support_contact: settings.support_contact ?? "" }}
        />
      </Card>
    </div>
  );
}
