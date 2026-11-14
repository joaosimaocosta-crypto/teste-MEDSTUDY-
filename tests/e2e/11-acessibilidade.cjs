// MEDSTUDY MOZ — testes de acessibilidade (axe-core, WCAG 2.1 AA)
// Falha se houver violações "serious" ou "critical" em qualquer página verificada.
const path = require("node:path");
const fs = require("node:fs");
const { chromium, devices, S, BASE, ok, sql, createUser, login, newContext, finish } = require("./lib/helpers.cjs");

const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const report = [];

async function audit(page, url, label) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    // Analisa só o que está visível (o Next.js mantém páginas anteriores escondidas)
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return r.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  });
  ok(`${label} ${url}`, violations.length === 0, violations.map((v) => `${v.id}: ${v.nodes.join(", ")}`).join(" | ").slice(0, 400));
  if (violations.length) report.push({ label, url, violations });
}

(async () => {
  const t = Date.now();
  const stuEmail = `a11y${t}@teste.local`, adminEmail = `a11yadmin${t}@teste.local`;
  const stuId = await createUser(stuEmail, "Estudante Acessível");
  const adminId = await createUser(adminEmail, "Admin Acessível");
  sql(`update profiles set role='admin' where id='${adminId}'`);
  sql(`insert into subscriptions (user_id, plan_id, status, starts_at, expires_at) values ('${stuId}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days')`);
  sql(`insert into quiz_attempts (quiz_id, user_id, status, submitted_at, score, max_score, percentage, passed) values ('70000000-0000-0000-0000-000000000001', '${stuId}', 'submitted', now(), 2, 3, 66.67, true)`);
  const attemptId = sql(`select id from quiz_attempts where user_id='${stuId}' limit 1`);

  const PUBLIC = ["/", "/entrar", "/registar", "/recuperar-senha", "/pagina-que-nao-existe"];
  const STUDENT = [
    "/painel", "/cursos", "/cursos/tecnico-medicina-geral", "/cursos/tecnico-medicina-geral/anatomia-fisiologia",
    "/aulas/50000000-0000-0000-0000-000000000001", "/manuais", "/manuais/60000000-0000-0000-0000-000000000001",
    "/testes", "/testes/70000000-0000-0000-0000-000000000001", `/testes/tentativas/${attemptId}`,
    "/progresso", "/assinatura", "/perfil",
  ];
  const ADMIN = [
    "/admin", "/admin/estudantes", `/admin/estudantes/${stuId}`, "/admin/cursos",
    "/admin/aulas/50000000-0000-0000-0000-000000000001", "/admin/manuais", "/admin/manuais/novo",
    "/admin/testes", "/admin/testes/70000000-0000-0000-0000-000000000001",
    "/admin/planos", "/admin/assinaturas?estado=all", "/admin/pagamentos",
  ];

  const b = await chromium.launch();
  for (const [mode, opts] of [
    ["telemóvel/claro", { ...devices["iPhone 13"], colorScheme: "light" }],
    ["computador/escuro", { viewport: { width: 1366, height: 900 }, colorScheme: "dark" }],
  ]) {
    const anon = await (await newContext(b, opts)).newPage();
    for (const url of PUBLIC) await audit(anon, url, `[${mode}] visitante`);
    const sc = await newContext(b, opts);
    const stu = await sc.newPage();
    await login(stu, stuEmail);
    for (const url of STUDENT) await audit(stu, url, `[${mode}] estudante`);
    const ac = await newContext(b, opts);
    const adm = await ac.newPage();
    await login(adm, adminEmail);
    for (const url of ADMIN) await audit(adm, url, `[${mode}] admin`);
  }
  await b.close();
  fs.writeFileSync(path.join(S, "acessibilidade.json"), JSON.stringify(report, null, 2));
  finish();
})().catch((e) => finish(e));
