import { Badge } from "@/components/ui/badge";

/** Etiqueta do resultado de uma tentativa (ícone + texto, nunca só cor). */
export function AttemptBadge({ status, passed }: { status: string; passed: boolean }) {
  if (status === "expired") return <Badge tone="neutral">Tempo esgotado</Badge>;
  if (status === "in_progress") return <Badge tone="warning">Em curso</Badge>;
  return passed ? <Badge tone="success">Aprovado</Badge> : <Badge tone="danger">Reprovado</Badge>;
}
