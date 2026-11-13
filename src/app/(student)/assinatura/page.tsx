import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Assinatura" };

// Provisória — implementada numa fase seguinte do projecto.
export default function SubscriptionPage() {
  return <ComingSoon icon={CreditCard} title="Assinatura" description="O seu plano, datas e estado da assinatura." />;
}
