"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePassword } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/validations/auth";

export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <FormField
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
        required
      />
      <FormField
        label="Confirmar nova senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.confirmPassword}
        required
      />

      <SubmitButton fullWidth size="lg" pendingText="A guardar…">
        Guardar nova senha
      </SubmitButton>
    </form>
  );
}
