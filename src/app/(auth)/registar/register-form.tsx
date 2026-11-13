"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUp } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";
import { initialFormState } from "@/lib/validations/auth";

export function RegisterForm() {
  const [state, formAction] = useActionState(signUp, initialFormState);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <Alert variant="success">{state.success}</Alert>
        <Link href={ROUTES.login} className={buttonClasses({ variant: "secondary", fullWidth: true })}>
          Voltar a Entrar
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <FormField
        label="Nome completo"
        name="fullName"
        autoComplete="name"
        placeholder="Ex.: Ana Maria Machava"
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
        required
      />
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
      <FormField
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
        required
      />
      <FormField
        label="Confirmar senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.confirmPassword}
        required
      />

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-0.5 size-5 shrink-0 rounded accent-primary"
            aria-invalid={state.fieldErrors?.acceptTerms ? true : undefined}
          />
          <span>Aceito os termos de utilização e a política de privacidade do MEDSTUDY MOZ.</span>
        </label>
        {state.fieldErrors?.acceptTerms && (
          <p className="text-sm text-danger" role="alert">
            {state.fieldErrors.acceptTerms[0]}
          </p>
        )}
      </div>

      <SubmitButton fullWidth size="lg" pendingText="A criar conta…">
        Criar conta
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={ROUTES.login} className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
