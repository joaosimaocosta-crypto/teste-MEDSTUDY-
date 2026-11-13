import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy do Next.js 16 (antigo "middleware").
 * Corre antes de cada pedido abrangido pelo `matcher`.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todas as rotas EXCEPTO:
     *  - _next/static, _next/image (ficheiros do Next.js)
     *  - favicon e imagens
     *  - api/health (monitorização, não precisa de sessão)
     */
    "/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
