"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";
import { initialFormState } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.success && <Alert variant="success">{state.success}</Alert>}

      <FormField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="o-seu-email@exemplo.com"
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
        required
      />

      <SubmitButton fullWidth size="lg" pendingText="A enviar…">
        Enviar link
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Lembrou-se da senha?{" "}
        <Link href={ROUTES.login} className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
