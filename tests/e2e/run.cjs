// =============================================================================
// MEDSTUDY MOZ — executa todos os testes de ponta a ponta
//
//   npm run build          (uma vez, antes)
//   npm run test:e2e       (todos)   |   npm run test:e2e -- 06 08   (só alguns)
//
// Requisitos: Supabase LOCAL a correr (npm run db:start) e .env.local com as
// chaves locais. NUNCA apontar estes testes para o projecto de produção: criam
// utilizadores e alteram dados directamente na base de dados.
// =============================================================================
const { spawn, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { startLunesServer } = require("./lib/lunes-server.cjs");

const ROOT = path.resolve(__dirname, "../..");
const TMP = path.join(__dirname, ".tmp");
const ARTIFACTS = path.join(__dirname, ".artifacts");
const PORT = 3000;

function readEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

async function prepareFixtures() {
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  if (!fs.existsSync(path.join(TMP, "cert.pem"))) {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 30 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { cwd: TMP, stdio: "ignore" },
    );
  }
  if (!fs.existsSync(path.join(TMP, "manual.pdf"))) {
    const b = await chromium.launch();
    const p = await b.newPage();
    const pages = Array.from({ length: 5 }, (_, i) =>
      `<section style="page-break-after:always;font-family:sans-serif;padding:40px"><h1>Manual de Teste</h1><h2>Página ${i + 1}</h2><p>${"Conteúdo do manual oficial. ".repeat(60)}</p></section>`,
    ).join("");
    await p.setContent(`<html><body style="margin:0">${pages}</body></html>`);
    await p.pdf({ path: path.join(TMP, "manual.pdf"), format: "A4" });
    await b.close();
  }
}

async function waitFor(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Servidor não respondeu: ${url}`);
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

(async () => {
  const envLocal = readEnvLocal();
  const supabaseUrl = envLocal.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  if (!/127\.0\.0\.1|localhost/.test(supabaseUrl)) {
    console.error("Recusado: os testes só correm contra o Supabase LOCAL (.env.local aponta para outro servidor).");
    process.exit(1);
  }
  // Se já houver algo na porta, os testes correriam contra uma versão antiga da app.
  const busy = await fetch(`http://localhost:${PORT}`).then(() => true).catch(() => false);
  if (busy) {
    console.error(`A porta ${PORT} já está ocupada (outro servidor a correr?). Pare-o antes de executar os testes.`);
    process.exit(1);
  }
  await prepareFixtures();
  const lunes = await startLunesServer(TMP, 8443);

  const env = {
    ...process.env,
    E2E_BASE_URL: `http://localhost:${PORT}`,
    E2E_SUPABASE_URL: supabaseUrl,
    E2E_SECRET_KEY: envLocal.SUPABASE_SECRET_KEY,
    E2E_ARTIFACTS: ARTIFACTS,
    NODE_EXTRA_CA_CERTS: path.join(TMP, "cert.pem"),
  };

  // Aplicação em modo produção, autorizando o "servidor de manuais" de teste
  const app = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: { ...env, MANUALS_ALLOWED_HOSTS: "localhost" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  try {
    await waitFor(`http://localhost:${PORT}/api/health`);
    const filters = process.argv.slice(2);
    const files = fs
      .readdirSync(__dirname)
      .filter((f) => /^\d+-.*\.cjs$/.test(f))
      .filter((f) => filters.length === 0 || filters.some((x) => f.startsWith(x)))
      .sort();
    const summary = [];
    for (const f of files) {
      console.log(`\n=== ${f} ===`);
      const code = await run(process.execPath, [path.join(__dirname, f)], env);
      summary.push(`${code === 0 ? "OK  " : "FALHOU"}  ${f}`);
    }
    console.log(`\n=== Resumo ===\n${summary.join("\n")}`);
    process.exitCode = summary.some((s) => s.startsWith("FALHOU")) ? 1 : 0;
  } finally {
    app.kill("SIGTERM");
    lunes.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
