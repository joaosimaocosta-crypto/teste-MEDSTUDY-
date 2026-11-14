"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/validations/auth";
import { changeUserRole } from "./actions";

/**
 * Promover / despromover — com passo de confirmação (acção sensível).
 */
export function RoleControl({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string;
  currentRole: "student" | "admin";
  isSelf: boolean;
}) {
  const [state, formAction] = useActionState(changeUserRole, initialFormState);
  const [confirming, setConfirming] = useState(false);
  const target = currentRole === "admin" ? "student" : "admin";

  if (isSelf) {
    return <p className="text-sm text-muted-foreground">Esta é a sua conta — o seu papel não pode ser alterado aqui.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      {!confirming ? (
        <Button
          variant={target === "admin" ? "secondary" : "danger"}
          size="sm"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          {target === "admin" ? (
            <>
              <ShieldCheck className="size-4" aria-hidden /> Promover a administrador
            </>
          ) : (
            <>
              <ShieldOff className="size-4" aria-hidden /> Remover acesso de administrador
            </>
          )}
        </Button>
      ) : (
        <form action={formAction} onSubmit={() => setConfirming(false)} className="flex flex-col gap-3">
          <p className="text-sm">
            {target === "admin"
              ? "Este utilizador passará a ter acesso total à administração (conteúdos, estudantes, assinaturas e pagamentos). Confirmar?"
              : "Este utilizador perderá o acesso à administração. Confirmar?"}
          </p>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="role" value={target} />
          <div className="flex gap-2">
            <SubmitButton variant={target === "admin" ? "primary" : "danger"} size="sm" pendingText="A guardar…">
              Confirmar
            </SubmitButton>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
