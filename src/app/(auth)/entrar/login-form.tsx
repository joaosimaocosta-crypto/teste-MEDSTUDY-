"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/auth/routes";
import { initialFormState } from "@/lib/validations/auth";

const URL_MESSAGES: Record<string, string> = {
  "link-invalido": "O link é inválido ou expirou. Peça um novo link.",
  sessao: "A sua sessão expirou. Entre novamente.",
};

/**
 * Parte do formulário que depende do URL (?next=, ?erro=).
 * Fica dentro de <Suspense> para o resto da página poder ser pré-gerado.
 */
function UrlState() {
  const params = useSearchParams();
  const message = URL_MESSAGES[params.get("erro") ?? ""];
  return (
    <>
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {message && <Alert variant="error">{message}</Alert>}
    </>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Suspense fallback={null}>
        <UrlState />
      </Suspense>

      {state.error && <Alert variant="error">{state.error}</Alert>}

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
        autoComplete="current-password"
        errors={state.fieldErrors?.password}
        required
      />

      <div className="-mt-1 text-right">
        <Link href={ROUTES.forgotPassword} className="text-sm font-medium text-primary hover:underline">
          Esqueceu a senha?
        </Link>
      </div>

      <SubmitButton fullWidth size="lg" pendingText="A entrar…">
        Entrar
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href={ROUTES.register} className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
