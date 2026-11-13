import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Manuais" };

// Provisória — implementada numa fase seguinte do projecto.
export default function ManualsPage() {
  return <ComingSoon icon={FileText} title="Manuais" description="Biblioteca de manuais oficiais em PDF." />;
}
