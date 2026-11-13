import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Vai buscar um PDF externo (Lunes Host) com protecção contra SSRF:
 *  - só https;
 *  - se MANUALS_ALLOWED_HOSTS estiver definido, só esses domínios;
 *  - caso contrário, bloqueia localhost e redes privadas (incluindo nomes que
 *    resolvem para IPs privados);
 *  - redireccionamentos seguidos manualmente (máx. 3) e validados um a um.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 30_000;

function allowedHosts(): string[] {
  return (process.env.MANUALS_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" || v6 === "::1" ||
    v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") ||
    v6.startsWith("::ffff:") && isPrivateIp(v6.slice(7))
  );
}

export class PdfFetchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PdfFetchError("Endereço do PDF inválido", 502);
  }
  if (url.protocol !== "https:") throw new PdfFetchError("O PDF tem de usar https", 502);

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const allow = allowedHosts();
  if (allow.length > 0) {
    if (!allow.includes(host)) throw new PdfFetchError(`Domínio não autorizado: ${host}`, 502);
    return url; // domínio explicitamente autorizado pelo administrador do sistema
  }

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new PdfFetchError("Endereço interno bloqueado", 502);
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new PdfFetchError("Não foi possível resolver o domínio do PDF", 502);
  if (addresses.some((a) => isPrivateIp(a.address))) throw new PdfFetchError("Endereço interno bloqueado", 502);
  return url;
}

/** Faz o pedido ao servidor do PDF, encaminhando o cabeçalho Range (leitura por partes). */
export async function fetchPdf(rawUrl: string, range: string | null): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeUrl(current);
    const headers: Record<string, string> = { Accept: "application/pdf" };
    if (range && /^bytes=\d*-\d*(,\s*\d*-\d*)*$/.test(range)) headers.Range = range;

    let res: Response;
    try {
      res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch (e) {
      console.error("[manuais] fetch falhou:", (e as Error).message);
      throw new PdfFetchError("O servidor dos manuais não respondeu", 502);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    if (!res.ok && res.status !== 206) {
      throw new PdfFetchError(`O servidor dos manuais respondeu ${res.status}`, res.status === 404 ? 404 : 502);
    }
    return res;
  }
  throw new PdfFetchError("Demasiados redireccionamentos", 502);
}
