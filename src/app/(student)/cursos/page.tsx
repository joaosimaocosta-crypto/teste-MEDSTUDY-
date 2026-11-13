import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Cursos" };

// Provisória — implementada numa fase seguinte do projecto.
export default function CoursesPage() {
  return <ComingSoon icon={BookOpen} title="Cursos" description="Disciplinas, módulos, capítulos e aulas do seu curso." />;
}
