import type { Metadata } from "next";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova senha" };

/**
 * Página aberta a partir do link de recuperação (que cria uma sessão temporária).
 * Sem sessão, o proxy.ts redirecciona para /entrar; a Server Action volta a verificar.
 */
export default function NewPasswordPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Definir nova senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escolha uma nova senha para a sua conta.</p>
      </div>
      <NewPasswordForm />
    </>
  );
}
