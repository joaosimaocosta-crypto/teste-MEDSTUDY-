import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

/** Página 404 em português (endereço inexistente ou conteúdo não publicado). */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo />
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <SearchX className="size-7" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Erro 404</p>
        <h1 className="text-2xl font-bold tracking-tight">Página não encontrada</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          O endereço pode estar errado ou o conteúdo já não está disponível.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/painel" className={buttonClasses()}>
          Ir para o painel
        </Link>
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          Página inicial
        </Link>
      </div>
    </main>
  );
}
