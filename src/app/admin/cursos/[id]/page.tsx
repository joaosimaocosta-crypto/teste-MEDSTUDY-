import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { NodePage } from "@/components/features/content-admin/node-page";

export const metadata: Metadata = { title: "Editar curso · Administração" };

export default function AdminCoursePage({ params }: PageProps<"/admin/cursos/[id]">) {
  return (
    <AdminOnly>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <NodePage level="course" params={params} />
      </Suspense>
    </AdminOnly>
  );
}
