import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { AdminOnly } from "@/components/auth/admin-only";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Assinaturas · Administração" };

// Provisória — implementada na Fase 10. (Protegida por <AdminOnly>.)
export default function AdminSubscriptionsPage() {
  return (
    <AdminOnly>
      <ComingSoon icon={CreditCard} title="Assinaturas" description="Activar, suspender e renovar assinaturas." backHref="/admin" />
    </AdminOnly>
  );
}
