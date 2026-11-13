import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { StudentCrumbs } from "@/components/features/catalog/crumbs";
import { PdfViewer } from "@/components/features/manuals/pdf-viewer";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/auth/routes";
import { getManualForStudent } from "@/lib/services/manuals";

export const metadata: Metadata = { title: "Manual" };

export default function ManualPage({ params }: PageProps<"/manuais/[id]">) {
  return (
    <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
      <ManualContent params={params} />
    </Suspense>
  );
}

async function ManualContent({ params }: { params: PageProps<"/manuais/[id]">["params"] }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const manual = await getManualForStudent(id);
  if (!manual) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <StudentCrumbs items={[{ href: ROUTES.manuals, label: "Manuais" }, { label: manual.title }]} />
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{manual.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {manual.course?.title}
          {manual.subject ? ` · ${manual.subject.title}` : ""}
          {manual.page_count ? ` · ${manual.page_count} páginas` : ""}
        </p>
        {manual.description && <p className="mt-2 text-muted-foreground">{manual.description}</p>}
      </header>

      {manual.isLocked ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Lock className="size-7" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Manual exclusivo para assinantes</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Active a sua assinatura para consultar este e os restantes manuais oficiais.
          </p>
          <Link href={ROUTES.subscription} className={buttonClasses({ size: "lg" })}>
            Ver planos de assinatura
          </Link>
        </Card>
      ) : (
        <PdfViewer src={`/api/manuals/${manual.id}`} title={manual.title} />
      )}
    </div>
  );
}
