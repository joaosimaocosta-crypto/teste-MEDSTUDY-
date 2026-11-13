import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { AdminOnly } from "@/components/auth/admin-only";
import { ComingSoon } from "@/components/features/coming-soon";

export const metadata: Metadata = { title: "Pagamentos · Administração" };

// Provisória — implementada na Fase 10. (Protegida por <AdminOnly>.)
export default function AdminPaymentsPage() {
  return (
    <AdminOnly>
      <ComingSoon icon={ReceiptText} title="Pagamentos" description="Pagamentos registados manualmente." backHref="/admin" />
    </AdminOnly>
  );
}
