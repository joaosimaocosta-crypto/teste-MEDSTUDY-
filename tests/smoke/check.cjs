// =============================================================================
// MEDSTUDY MOZ — Verificação rápida depois de publicar ("smoke test")
//
//   npm run test:smoke -- https://o-seu-dominio.co.mz
//
// Só faz pedidos de LEITURA (GET), sem iniciar sessão nem alterar dados.
// Pode ser corrido contra a produção sempre que houver uma nova publicação.
// =============================================================================
const base = (process.argv[2] || process.env.SMOKE_URL || "").replace(/\/+$/, "");
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error("Uso: npm run test:smoke -- https://o-seu-dominio.co.mz");
  process.exit(2);
}
const isHttps = base.startsWith("https://");
let failed = 0;

function check(name, cond, detail = "") {
  console.log(`${cond ? "✔" : "✘"} ${name}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

async function get(path, opts = {}) {
  return fetch(base + path, { redirect: "manual", headers: { "user-agent": "medstudy-smoke" }, ...opts });
}

(async () => {
  console.log(`A verificar ${base}\n`);

  // 1. Saúde (aplicação + base de dados)
  try {
    const r = await get("/api/health");
    const body = await r.json().catch(() => ({}));
    check("Saúde: /api/health responde 200 com base de dados ok", r.status === 200 && body.database === "ok", `HTTP ${r.status} ${JSON.stringify(body)}`);
  } catch (e) {
    check("Servidor acessível", false, e.message);
    process.exit(1);
  }

  // 2. Página inicial e cabeçalhos de segurança
  const home = await get("/");
  const h = (k) => home.headers.get(k) || "";
  check("Página inicial responde 200", home.status === 200, `HTTP ${home.status}`);
  check("Content-Security-Policy presente", h("content-security-policy").includes("default-src 'self'"));
  check("X-Content-Type-Options: nosniff", h("x-content-type-options") === "nosniff");
  check("X-Frame-Options: DENY", h("x-frame-options") === "DENY");
  check("Referrer-Policy definido", h("referrer-policy") !== "");
  check("Sem cabeçalho X-Powered-By", !home.headers.has("x-powered-by"));
  if (isHttps) {
    check("Strict-Transport-Security (HSTS) activo", /max-age=\d+/.test(h("strict-transport-security")), "verifique NEXT_PUBLIC_SITE_URL=https://…");
    check("CSP força https (upgrade-insecure-requests)", h("content-security-policy").includes("upgrade-insecure-requests"));
  }

  // 3. Áreas privadas redireccionam para o login (sem sessão)
  for (const path of ["/painel", "/cursos", "/manuais", "/admin", "/admin/estudantes"]) {
    const r = await get(path);
    const loc = r.headers.get("location") || "";
    check(`${path} sem sessão → /entrar`, r.status >= 300 && r.status < 400 && loc.includes("/entrar"), `HTTP ${r.status} location=${loc}`);
  }

  // 4. API protegida não devolve dados sem sessão
  const pdf = await get("/api/manuals/00000000-0000-0000-0000-000000000000");
  check("PDF de manual sem sessão é recusado", [302, 303, 307, 401, 403, 404].includes(pdf.status), `HTTP ${pdf.status}`);

  // 5. Página 404 em português
  const nf = await get("/pagina-que-nao-existe-" + Date.now());
  check("Página inexistente → 404 em português", nf.status === 404 && (await nf.text()).includes("Página não encontrada"), `HTTP ${nf.status}`);

  // 6. Ficheiros públicos para motores de busca e telemóvel
  const robots = await get("/robots.txt");
  const robotsTxt = await robots.text();
  check("robots.txt bloqueia áreas privadas", robots.status === 200 && robotsTxt.includes("Disallow: /admin") && robotsTxt.includes("Disallow: /painel"));
  check("robots.txt aponta para o sitemap deste domínio", robotsTxt.includes(`Sitemap: ${base}/sitemap.xml`), "verifique NEXT_PUBLIC_SITE_URL");
  const sm = await get("/sitemap.xml");
  check("sitemap.xml disponível", sm.status === 200 && (await sm.text()).includes(`<loc>${base}/</loc>`));
  const mf = await get("/manifest.webmanifest");
  check("manifest.webmanifest disponível", mf.status === 200 && (await mf.json().catch(() => ({}))).short_name === "MEDSTUDY");

  console.log(`\n${failed === 0 ? "Tudo OK." : `${failed} verificação(ões) falharam.`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
