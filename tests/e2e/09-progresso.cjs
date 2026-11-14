// MEDSTUDY MOZ — testes de ponta a ponta: progresso
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { chromium, devices, S, BASE, ok, sql, V, waitText, createUser, login, newContext, finish } = require("./lib/helpers.cjs");
const tile = async (p, label) => (await p.locator(V(`main span:text-is("${label}")`)).locator('xpath=../..').locator('p').first().textContent()).trim();

(async () => {
  const t = Date.now();
  const stuEmail = `prog${t}@teste.local`, adminEmail = `padmin${t}@teste.local`, newEmail = `pnew${t}@teste.local`;
  const uid = await createUser(stuEmail, 'Estudante Progresso');
  const adminId = await createUser(adminEmail, 'Admin Progresso'); sql(`update profiles set role='admin' where id='${adminId}'`);
  await createUser(newEmail, 'Estudante Novo');
  sql(`insert into subscriptions (user_id, plan_id, status, starts_at, expires_at) values ('${uid}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '30 days', now() + interval '30 days')`);
  sql(`insert into student_progress (user_id, lesson_id, status, completed_at) values ('${uid}', '50000000-0000-0000-0000-000000000001', 'completed', now()), ('${uid}', '50000000-0000-0000-0000-000000000002', 'completed', now())`);
  // Tentativas: 33%, 67%, 100% (mais antiga → mais recente)
  for (const [pct, d] of [[33.33, 5], [66.67, 3], [100, 1]]) {
    sql(`insert into quiz_attempts (quiz_id, user_id, status, started_at, submitted_at, score, max_score, percentage, passed) values ('70000000-0000-0000-0000-000000000001', '${uid}', 'submitted', now() - interval '${d} days', now() - interval '${d} days', 1, 3, ${pct}, ${pct >= 50})`);
  }
  // Histórico controlado de actividade: substitui o que os triggers registaram
  sql(`delete from student_activity_days where user_id='${uid}'`);
  sql(`insert into student_activity_days (user_id, day, lessons_viewed, lessons_completed, quizzes_submitted)
       select '${uid}', public._maputo_day(now()) - g, case when g = 0 then 5 else 1 end, 1, 0 from unnest(array[0,1,2,10,11,12,13]) g`);

  const b = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource|404/.test(m.text()) && errors.push(m.text())); };

  // ================= ESTUDANTE (telemóvel) =================
  const mc = await newContext(b, { ...devices['iPhone 13'] }); const p = await mc.newPage(); watch(p);
  await login(p, stuEmail);
  await p.goto(`${BASE}/progresso`);
  await waitText(p, 'Sequência actual');
  ok('Sequência actual = 3 dias', (await tile(p, 'Sequência actual')) === '3 dias');
  ok('Melhor sequência = 4 dias', (await tile(p, 'Melhor sequência')) === '4 dias');
  ok('Tempo de estudo = 40 min (15 + 25)', (await tile(p, 'Tempo de estudo')) === '40 min');
  ok('Nota "Já estudou hoje"', await p.isVisible(V('text=Já estudou hoje')));
  ok('Mapa: 7 dias com actividade', (await p.locator(V('span[title*="acções de estudo"], span[title*="acção de estudo"]')).count()) === 7);
  ok('Mapa: dia de hoje no nível mais alto', (await p.locator(V('span.bg-heat-4')).count()) >= 1);
  ok('Testes: 3 realizados, 2 aprovados, média 67%', (await p.locator(V('dd')).allTextContents()).join('|') === '3|2|67%');
  ok('Gráfico de linha com 3 pontos', (await p.locator(V('figure svg circle')).count()) === 3);
  ok('Rótulo directo no último ponto (100%)', (await p.locator(V('figure svg text')).allTextContents()).includes('100%'));
  ok('Tabela acessível do gráfico tem 3 linhas', (await p.locator('figure table tbody tr').count()) === 3);
  await p.locator(V('figure svg')).scrollIntoViewIfNeeded();
  const box = await p.locator(V('figure svg')).boundingBox();
  await p.touchscreen.tap(box.x + 40, box.y + 100);
  await p.waitForTimeout(300);
  ok('Tooltip ao tocar mostra a nota (e não desaparece)', (await p.locator(V('[role=tooltip]')).textContent()).includes('33%'));
  ok('Disciplina do seed: 2/2 · 40 min', await p.isVisible(V('text=2/2 · 40 min')));
  ok('Progresso (telemóvel) sem scroll horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.screenshot({ path: `${S}/f9-progresso-mobile.png`, fullPage: true });

  // Actividade em tempo real: abrir uma aula regista uma visita hoje
  const before = Number(sql(`select lessons_viewed from student_activity_days where user_id='${uid}' and day = public._maputo_day(now())`));
  await p.goto(`${BASE}/aulas/50000000-0000-0000-0000-000000000002`);
  await waitText(p, 'Ciclo cardíaco');
  await p.waitForTimeout(1500);
  const after = Number(sql(`select lessons_viewed from student_activity_days where user_id='${uid}' and day = public._maputo_day(now())`));
  ok('Abrir uma aula regista a visita do dia', after === before + 1, `${before} → ${after}`);
  await p.goto(`${BASE}/painel`);
  ok('Dashboard: "Dias de estudo" usa a mesma fonte (3/7)', (await tile(p, 'Dias de estudo')) === '3/7');
  await mc.close();

  // Estudante novo: estados vazios
  const nc = await newContext(b, { ...devices['Pixel 7'] }); const n = await nc.newPage(); watch(n);
  await login(n, newEmail);
  await n.goto(`${BASE}/progresso`);
  ok('Estudante novo: sequência 0 e "Comece hoje"', await waitText(n, 'Comece hoje') && (await tile(n, 'Sequência actual')) === '0 dias');
  ok('Estudante novo: convite para fazer testes', await n.isVisible(V('text=Ainda não fez nenhum teste')));
  await nc.close();

  // ================= ADMIN =================
  const ac = await newContext(b, { viewport: { width: 1366, height: 900 }, colorScheme: 'dark' }); const a = await ac.newPage(); watch(a);
  await login(a, adminEmail);
  await a.goto(`${BASE}/admin/estudantes/${uid}`);
  ok('Ficha mostra sequência e actividade', await waitText(a, 'Sequência actual: 3 dias'));
  ok('Ficha mostra progresso por disciplina', await a.isVisible(V('text=100% · 2/2 · 40 min')));
  await a.screenshot({ path: `${S}/f9-admin-ficha-dark.png`, fullPage: true });
  await a.goto(`${BASE}/admin/testes/70000000-0000-0000-0000-000000000001`);
  ok('Página do teste mostra taxa de acerto por pergunta', await waitText(a, 'Acerto:'));
  await a.goto(`${BASE}/admin`);
  ok('Visão geral: "Testes com mais dificuldade"', await waitText(a, 'Testes com mais dificuldade') && await a.isVisible(V('text=/aprovados · média/')));
  await ac.close();

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 400));
  await b.close();
  finish();
})().catch((e) => finish(e));
