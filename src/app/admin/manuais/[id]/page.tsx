import { ArrowLeft, Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AdminOnly } from "@/components/auth/admin-only";
import { DeleteManualForm, ManualForm } from "@/components/features/manuals/manual-form";
import { PdfViewer } from "@/components/features/manuals/pdf-viewer";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PUBLICATION_STATUS } from "@/lib/content/levels";
import { getCourseOptions, getManualForAdmin } from "@/lib/services/manuals";

export const metadata: Metadata = { title: "Editar manual · Administração" };

type Props = PageProps<"/admin/manuais/[id]">;

export default function EditManualPage({ params, searchParams }: Props) {
  return (
    <AdminOnly>
      <Link href="/admin/manuais" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Manuais
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <EditManual params={params} searchParams={searchParams} />
      </Suspense>
    </AdminOnly>
  );
}

async function EditManual({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(id).success) notFound();
  const [manual, { courses, subjects }] = await Promise.all([getManualForAdmin(id), getCourseOptions()]);
  if (!manual) notFound();
  const st = PUBLICATION_STATUS[manual.status];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      {sp.criado && <Alert variant="success">Manual criado. Verifique a pré-visualização abaixo antes de publicar.</Alert>}
      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {manual.title} <Badge tone={st.tone}>{st.label}</Badge>
      </h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Detalhes" />
          <ManualForm
            manual={{
              id: manual.id,
              title: manual.title,
              description: manual.description ?? "",
              status: manual.status,
              course_id: manual.course_id,
              subject_id: manual.subject_id ?? "",
              pdf_url: manual.pdf_url,
              page_count: manual.page_count ? String(manual.page_count) : "",
            }}
            courses={courses}
            subjects={subjects}
          />
        </Card>
        <Card className="self-start">
          <CardHeader title="Zona de perigo" />
          <DeleteManualForm id={manual.id} title={manual.title} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Pré-visualização" description="Tal como os estudantes o vêem (através da rota protegida)." action={<Eye className="size-5 text-muted-foreground" aria-hidden />} />
        <PdfViewer src={`/api/manuals/${manual.id}`} title={manual.title} />
      </Card>
    </div>
  );
}
