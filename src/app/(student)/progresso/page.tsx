import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Progresso" };

// Provisória — implementada numa fase seguinte do projecto.
export default function ProgressPage() {
  return <ComingSoon icon={TrendingUp} title="Progresso" description="A sua evolução ao longo do curso." />;
}
