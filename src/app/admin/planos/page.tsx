import { Tags } from "lucide-react";
import type { Metadata } from "next";
import { AdminOnly } from "@/components/auth/admin-only";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Planos · Administração" };

// Provisória — implementada na Fase 10. (Protegida por <AdminOnly>.)
export default function AdminPlansPage() {
  return (
    <AdminOnly>
      <ComingSoon icon={Tags} title="Planos" description="Planos de assinatura mensais." backHref="/admin" />
    </AdminOnly>
  );
}
