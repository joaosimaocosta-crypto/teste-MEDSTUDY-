import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health — verifica se a aplicação comunica com o Supabase.
 * Útil para testes e para monitorização após a publicação.
 * Não devolve dados: apenas o estado.
 */
export async function GET() {
  await connection(); // sempre executado no momento do pedido (nunca pré-gerado)

  const supabase = await createClient();
  const { error } = await supabase.from("courses").select("id", { head: true, count: "exact" });

  if (error) {
    console.error("[health] Erro na base de dados:", error.message);
    return NextResponse.json({ status: "error", database: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({ status: "ok", database: "ok" });
}
