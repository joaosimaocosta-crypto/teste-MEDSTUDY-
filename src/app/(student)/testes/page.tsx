import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Testes" };

// Provisória — implementada numa fase seguinte do projecto.
export default function QuizzesPage() {
  return <ComingSoon icon={ClipboardCheck} title="Testes" description="Avaliações com correcção automática e explicações." />;
}
