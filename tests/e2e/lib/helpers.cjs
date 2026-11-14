// =============================================================================
// MEDSTUDY MOZ — funções partilhadas pelos testes de ponta a ponta (Playwright)
// Variáveis de ambiente (definidas por tests/e2e/run.cjs):
//   E2E_BASE_URL, E2E_DB_URL, E2E_SUPABASE_URL, E2E_SECRET_KEY, E2E_ARTIFACTS
// =============================================================================
const { chromium, devices, request } = require("playwright");
const { execSync } = require("node:child_process");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DB = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SUPABASE = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.E2E_SECRET_KEY;
const S = process.env.E2E_ARTIFACTS ?? "tests/e2e/.artifacts";
const MAIL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324/api/v1"; // e-mails do Supabase local

const results = [];
/** Regista e imprime logo cada resultado (assim um bloqueio mostra até onde chegou). */
const ok = (name, cond, extra = "") => {
  const line = `${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  [${extra}]` : ""}`;
  results.push(line);
  console.log(line);
};

/** Executa SQL na base de dados LOCAL de testes (nunca usar em produção). */
const sql = (q) => execSync(`psql "${DB}" -qAtc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const V = (s) => `${s} >> visible=true`; // o Next.js mantém páginas anteriores escondidas no DOM
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitText = (p, t, timeout = 10000) =>
  p.waitForSelector(V(`text=${t}`), { timeout }).then(() => true).catch(() => false);
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Utilizador já confirmado, criado pela API de administração do Supabase LOCAL. */
async function createUser(email, name) {
  if (!KEY) throw new Error("E2E_SECRET_KEY em falta");
  const r = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Senha12345", email_confirm: true, user_metadata: { full_name: name } }),
  });
  return (await r.json()).id;
}

async function login(p, email) {
  await p.goto(`${BASE}/entrar`);
  await p.fill("input[name=email]", email);
  await p.fill("input[name=password]", "Senha12345");
  await p.click("button[type=submit]");
  await p.waitForURL(`${BASE}/painel`);
}

/**
 * Novo contexto de browser com um IP de cliente próprio (cabeçalho X-Forwarded-For),
 * como acontece com estudantes reais — a plataforma limita tentativas de login por IP.
 */
let ipCounter = Math.floor(Math.random() * 200);
function newContext(browser, opts = {}) {
  ipCounter = (ipCounter + 1) % 250;
  const ip = `198.51.100.${ipCounter + 1}`; // gama reservada para documentação/testes
  return browser.newContext({ ...opts, extraHTTPHeaders: { ...(opts.extraHTTPHeaders ?? {}), "x-forwarded-for": ip } });
}

/**
 * Imprime o resumo e TERMINA o processo (um browser aberto mantinha o Node vivo e as
 * mensagens ficavam presas no buffer — um erro passava despercebido).
 */
function finish(error) {
  const passed = results.filter((r) => r.startsWith("PASS")).length;
  const lines = [`\n${passed}/${results.length} passaram`];
  if (error) lines.push(`ERRO: ${error.stack ?? error.message}`);
  const code = error || passed !== results.length || results.length === 0 ? 1 : 0;
  process.stdout.write(lines.join("\n") + "\n", () => process.exit(code));
}

module.exports = { chromium, devices, request, BASE, DB, KEY, S, MAIL, results, ok, sql, V, sleep, waitText, noOverflow, createUser, login, newContext, finish };
