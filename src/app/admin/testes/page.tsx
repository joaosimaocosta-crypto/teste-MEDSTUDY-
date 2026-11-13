import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { AdminOnly } from "@/components/auth/admin-only";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Testes · Administração" };

// Provisória — implementada na Fase 8. (Protegida por <AdminOnly>.)
export default function AdminQuizzesPage() {
  return (
    <AdminOnly>
      <ComingSoon icon={ClipboardCheck} title="Testes" description="Testes e perguntas de escolha múltipla." backHref="/admin" />
    </AdminOnly>
  );
}
