import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { AdminOnly } from "@/components/auth/admin-only";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Cursos · Administração" };

// Provisória — implementada na Fase 6. (Protegida por <AdminOnly>.)
export default function AdminCoursesPage() {
  return (
    <AdminOnly>
      <ComingSoon icon={BookOpen} title="Cursos" description="Cursos, disciplinas, módulos, capítulos e aulas." backHref="/admin" />
    </AdminOnly>
  );
}
