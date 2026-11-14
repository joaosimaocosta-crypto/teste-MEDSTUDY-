"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";

/**
 * Erro inesperado numa página. Em produção, o Next.js não envia ao browser os
 * detalhes de erros do servidor (só um identificador "digest" para os logs).
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    console.error("[erro]", digest ?? error);
  }, [error, digest]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Algo correu mal</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Ocorreu um erro inesperado. Verifique a ligação à internet e tente novamente.
        </p>
        {digest && <p className="mt-2 text-xs text-muted-foreground">Código do erro: {digest}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => retry()}>
          <RotateCcw className="size-4" aria-hidden /> Tentar novamente
        </Button>
        <Link href="/painel" className={buttonClasses({ variant: "secondary" })}>
          Ir para o painel
        </Link>
      </div>
    </main>
  );
}
