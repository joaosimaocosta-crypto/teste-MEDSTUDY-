import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { NodePage } from "@/components/features/content-admin/node-page";

export const metadata: Metadata = { title: "Editar aula · Administração" };

export default function AdminLessonPage({ params }: PageProps<"/admin/aulas/[id]">) {
  return (
    <AdminOnly>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <NodePage level="lesson" params={params} />
      </Suspense>
    </AdminOnly>
  );
}
