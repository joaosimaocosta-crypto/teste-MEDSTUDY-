import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { AdminOnly } from "@/components/auth/admin-only";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Manuais · Administração" };

// Provisória — implementada na Fase 7. (Protegida por <AdminOnly>.)
export default function AdminManualsPage() {
  return (
    <AdminOnly>
      <ComingSoon icon={FileText} title="Manuais" description="Biblioteca de manuais em PDF." backHref="/admin" />
    </AdminOnly>
  );
}
