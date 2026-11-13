import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { ManualForm } from "@/components/features/manuals/manual-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCourseOptions } from "@/lib/services/manuals";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Novo manual · Administração" };

export default function NewManualPage() {
  return (
    <AdminOnly>
      <Link href="/admin/manuais" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Manuais
      </Link>
      <PageHeader title="Novo manual" description="Carregue o PDF na Lunes Host e cole aqui o endereço do ficheiro." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <NewManual />
      </Suspense>
    </AdminOnly>
  );
}

async function NewManual() {
  const { courses, subjects } = await getCourseOptions();
  if (courses.length === 0) {
    return (
      <Card>
        <EmptyState icon={BookOpen} title="Crie primeiro um curso" description="Cada manual pertence a um curso." />
      </Card>
    );
  }
  return (
    <Card className="max-w-3xl">
      <ManualForm
        manual={{ title: "", description: "", status: "draft", course_id: courses[0].id, subject_id: "", pdf_url: "", page_count: "" }}
        courses={courses}
        subjects={subjects}
      />
    </Card>
  );
}
