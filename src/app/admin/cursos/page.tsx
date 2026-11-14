import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOnly } from "@/components/auth/admin-only";
import { ChildrenPanel } from "@/components/features/content-admin/node-page";
import { PageHeader } from "@/components/ui/page-header";
import { listCourses } from "@/lib/services/content-admin";

export const metadata: Metadata = { title: "Cursos · Administração" };

export default function AdminCoursesPage() {
  return (
    <AdminOnly>
      <PageHeader
        title="Cursos"
        description="Organize os conteúdos: Curso → Disciplina → Módulo → Capítulo → Aula. Novos itens são criados como rascunho."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-muted" aria-label="A carregar" />}>
        <CoursesList />
      </Suspense>
    </AdminOnly>
  );
}

async function CoursesList() {
  const courses = await listCourses();
  return (
    <div className="max-w-2xl">
      <ChildrenPanel level="course" items={courses} />
    </div>
  );
}
