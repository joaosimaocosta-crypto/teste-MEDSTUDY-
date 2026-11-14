// =============================================================================
// MEDSTUDY MOZ — medição de desempenho em rede móvel lenta
//
//   npm run build && npx next start -p 3000   (noutro terminal)
//   node tests/perf/measure.cjs
//
// Simula um telemóvel Android em 3G "rápido" (1,6 Mbps, 150 ms) com CPU 4× mais lento
// e mede FCP, LCP e os bytes transferidos (comprimidos) por tipo de recurso.
// =============================================================================
const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices, BASE, S, sql, createUser, login, newContext } = require("../e2e/lib/helpers.cjs");

const NETWORK = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

async function measure(context, url) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", NETWORK);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const bytes = { script: 0, stylesheet: 0, font: 0, document: 0, other: 0 };
  const types = new Map();
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type.toLowerCase()));
  cdp.on("Network.loadingFinished", (e) => {
    const t = types.get(e.requestId) ?? "other";
    bytes[t in bytes ? t : "other"] += e.encodedDataLength;
  });

  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const start = Date.now();
  await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  const load = Date.now() - start;
  const m = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
    lcp: window.__lcp || null,
  }));
  await page.close();
  const kb = (n) => Math.round(n / 1024);
  return {
    url,
    fcp_ms: m.fcp && Math.round(m.fcp),
    lcp_ms: m.lcp && Math.round(m.lcp),
    load_ms: load,
    js_kb: kb(bytes.script),
    css_kb: kb(bytes.stylesheet),
    font_kb: kb(bytes.font),
    total_kb: kb(Object.values(bytes).reduce((a, b) => a + b, 0)),
  };
}

(async () => {
  const t = Date.now();
  const email = `perf${t}@teste.local`;
  const uid = await createUser(email, "Estudante Desempenho");
  sql(`insert into subscriptions (user_id, plan_id, status, starts_at, expires_at) values ('${uid}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days')`);

  const b = await chromium.launch();
  const opts = { ...devices["Pixel 7"] };
  const rows = [];
  const anon = await newContext(b, opts);
  for (const url of ["/", "/entrar", "/registar"]) rows.push(await measure(anon, url));
  const ctx = await newContext(b, opts);
  await login(await ctx.newPage(), email);
  for (const url of [
    "/painel",
    "/cursos/tecnico-medicina-geral/anatomia-fisiologia",
    "/aulas/50000000-0000-0000-0000-000000000001",
    "/testes",
    "/progresso",
    "/manuais/60000000-0000-0000-0000-000000000001",
  ])
    rows.push(await measure(ctx, url));
  await b.close();

  console.table(rows);
  fs.mkdirSync(S, { recursive: true });
  fs.writeFileSync(path.join(S, "desempenho.json"), JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
