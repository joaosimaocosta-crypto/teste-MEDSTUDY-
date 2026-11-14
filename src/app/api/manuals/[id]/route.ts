import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fetchPdf, PdfFetchError } from "@/lib/manuals/fetch-pdf";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/manuals/[id] — entrega protegida de um manual em PDF.
 *
 * 1. Verifica a sessão (401 se não houver).
 * 2. Pede o endereço à BD com get_manual_pdf_url(): a própria função verifica
 *    se o manual está publicado e se o estudante tem assinatura activa
 *    (403 sem assinatura, 404 se não existir). Administradores têm sempre acesso.
 * 3. Vai buscar o PDF à Lunes Host e devolve-o em streaming.
 *    O endereço real NUNCA é enviado ao browser.
 */

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/manuals/[id]">) {
  const { id } = await ctx.params;
  if (!z.guid().safeParse(id).success) return jsonError("Manual não encontrado", 404);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return jsonError("Sessão necessária", 401);

  const [{ data: pdfUrl, error }, { data: meta }] = await Promise.all([
    supabase.rpc("get_manual_pdf_url", { p_manual_id: id }),
    supabase.from("manuals").select("title").eq("id", id).maybeSingle(),
  ]);
  if (error || !pdfUrl) {
    if (error?.code === "42501") return jsonError("Assinatura activa necessária", 403);
    return jsonError("Manual não encontrado", 404);
  }

  let upstream: Response;
  try {
    upstream = await fetchPdf(pdfUrl, request.headers.get("range"));
  } catch (e) {
    const err = e instanceof PdfFetchError ? e : new PdfFetchError("Erro ao obter o manual", 502);
    console.error(`[manuais] ${id}:`, err.message);
    return jsonError("Não foi possível carregar o manual. Tente mais tarde.", err.status === 404 ? 404 : 502);
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!/pdf|octet-stream/i.test(type)) {
    console.error(`[manuais] ${id}: tipo inesperado`, type);
    return jsonError("O ficheiro do manual não é um PDF válido.", 502);
  }

  const filename = (meta?.title ?? "manual").normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "manual";
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}.pdf"`,
    // privado: só o browser do estudante guarda (nunca caches partilhadas)
    "Cache-Control": "private, max-age=600",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": upstream.headers.get("accept-ranges") ?? "none",
  });
  for (const h of ["content-length", "content-range", "last-modified", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
}
