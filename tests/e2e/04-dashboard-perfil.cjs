// MEDSTUDY MOZ — testes de ponta a ponta: dashboard perfil
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { chromium, devices, S, BASE, ok, sql, noOverflow, createUser, login, newContext, finish } = require("./lib/helpers.cjs");

(async () => {
  const t = Date.now();
  const full = `full${t}@teste.local`, empty = `vazio${t}@teste.local`;
  const uid = await createUser(full, 'Beatriz Cossa Teste');
  await createUser(empty, 'Carlos Novo');
  // Dados de teste para o estudante "full": assinatura activa, 2 aulas concluídas, 1 teste
  sql(`insert into public.subscriptions (user_id, plan_id, status, starts_at, expires_at)
       values ('${uid}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '2 days', now() + interval '28 days')`);
  sql(`insert into public.student_progress (user_id, lesson_id, status, completed_at, last_viewed_at) values
       ('${uid}', '50000000-0000-0000-0000-000000000001', 'completed', now() - interval '1 day', now() - interval '1 day'),
       ('${uid}', '50000000-0000-0000-0000-000000000002', 'completed', now(), now())`);
  // Actividade diária (desde a Fase 9 é registada por triggers; os dados acima ficam todos em "hoje")
  sql(`insert into public.student_activity_days (user_id, day, lessons_completed) values ('${uid}', public._maputo_day(now() - interval '1 day'), 1) on conflict do nothing`);
  sql(`insert into public.quiz_attempts (quiz_id, user_id, status, submitted_at, score, max_score, percentage, passed)
       values ('70000000-0000-0000-0000-000000000001', '${uid}', 'submitted', now(), 2, 3, 66.67, true)`);

  const b = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text())); };

  // ---------- Página inicial ----------
  for (const [name, opts] of [['mobile', devices['Pixel 7']], ['desktop', { viewport: { width: 1366, height: 900 } }]]) {
    const c = await newContext(b, { ...opts, colorScheme: 'light' }); const p = await c.newPage(); watch(p);
    await p.goto(BASE);
    ok(`Página inicial (${name}) sem scroll horizontal`, await noOverflow(p));
    await p.screenshot({ path: `${S}/f4-home-${name}.png`, fullPage: true });
    await c.close();
  }

  // ---------- Telemóvel: estudante com dados ----------
  const m = await newContext(b, { ...devices['iPhone 13'] }); const p = await m.newPage(); watch(p);
  await login(p, full);
  await p.waitForSelector('text=Olá, Beatriz');
  const tile = async label => (await p.locator(`text=${label}`).locator('xpath=../..').locator('p').first().textContent()).trim();
  ok('KPI aulas concluídas = 2', (await tile('Aulas concluídas')) === '2');
  ok('KPI testes realizados = 1', (await tile('Testes realizados')) === '1');
  ok('KPI média = 67%', (await tile('Média nos testes')) === '67%');
  ok('Dias de estudo = 2/7', (await tile('Dias de estudo')) === '2/7');
  ok('Assinatura activa com dias restantes', await p.isVisible('text=Plano Mensal (exemplo)') && await p.isVisible('text=/28 dias restantes/'));
  ok('Progresso por disciplina 100% (2/2)', await p.isVisible('text=(2/2)'));
  ok('Último teste mostra 67% e Aprovado', await p.isVisible('text=Teste: O Coração') && await p.isVisible('text=Aprovado'));
  ok('Barra inferior visível no telemóvel', await p.isVisible('nav.fixed >> text=Manuais'));
  ok('Barra lateral escondida no telemóvel', !(await p.locator('aside').isVisible()));
  ok('Dashboard (telemóvel) sem scroll horizontal', await noOverflow(p));
  // Gráfico: 7 colunas, tooltip ao tocar
  const bars = p.locator('figure button');
  ok('Gráfico tem 7 colunas', (await bars.count()) === 7);
  await bars.nth(6).click();
  ok('Tooltip mostra valor de hoje (1 aula)', (await p.locator('[role=tooltip]').textContent()).includes('1aula'));
  ok('Tabela acessível do gráfico existe', (await p.locator('figure table tbody tr').count()) === 7);
  await p.screenshot({ path: `${S}/f4-painel-mobile.png`, fullPage: true });

  // Navegação
  await p.click('nav.fixed >> text=Cursos');
  await p.waitForURL(`${BASE}/cursos`);
  ok('Navegação para Cursos marca o item activo', (await p.locator('nav.fixed a[aria-current=page]').first().textContent()).includes('Cursos'));
  ok('Página Cursos mostra o catálogo', await p.waitForSelector('text=Técnico de Medicina Geral >> visible=true', { timeout: 8000 }).then(() => true).catch(() => false));

  // Perfil
  await p.click('nav.fixed >> text=Perfil'); await p.waitForURL(`${BASE}/perfil`);
  await p.waitForSelector('input[name=fullName]');
  await p.fill('input[name=phone]', '123');
  await p.click('button:has-text("Guardar alterações")');
  await p.waitForSelector('text=Número inválido');
  ok('Telefone inválido é rejeitado', true);
  await p.fill('input[name=fullName]', 'Beatriz Cossa');
  await p.fill('input[name=phone]', '+258 84 123 4567');
  await p.selectOption('select[name=province]', 'Sofala');
  await p.fill('input[name=institution]', 'Instituto de Ciências de Saúde da Beira');
  await p.selectOption('select[name=academicYear]', '2');
  await p.click('button:has-text("Guardar alterações")');
  await p.waitForSelector('text=Perfil actualizado com sucesso.');
  ok('Perfil guardado', true);
  ok('BD: telefone normalizado e província guardada', sql(`select phone || '|' || province || '|' || academic_year from profiles where id='${uid}'`) === '+258841234567|Sofala|2');
  await p.reload(); await p.waitForSelector('input[name=fullName]');
  ok('Após recarregar mostra valores guardados', (await p.inputValue('input[name=phone]')) === '84 123 4567' && (await p.inputValue('select[name=province]')) === 'Sofala');
  ok('Perfil (telemóvel) sem scroll horizontal', await noOverflow(p));
  await p.screenshot({ path: `${S}/f4-perfil-mobile.png`, fullPage: true });
  await m.close();

  // ---------- Computador, tema escuro ----------
  const d = await newContext(b, { viewport: { width: 1366, height: 900 }, colorScheme: 'dark' }); const dp = await d.newPage(); watch(dp);
  await login(dp, full);
  await dp.waitForSelector('text=Olá, Beatriz');
  ok('Barra lateral visível no computador', await dp.locator('aside').isVisible());
  ok('Barra inferior escondida no computador', !(await dp.locator('nav.fixed').isVisible()));
  ok('Tema escuro activo', (await dp.evaluate(() => document.documentElement.className)).includes('dark'));
  await dp.locator('figure button').nth(5).hover();
  await dp.screenshot({ path: `${S}/f4-painel-desktop-dark.png` });
  await d.close();

  // ---------- Estudante novo (estados vazios) ----------
  const e = await newContext(b, { ...devices['Pixel 7'] }); const ep = await e.newPage(); watch(ep);
  await login(ep, empty);
  await ep.waitForSelector('text=Olá, Carlos');
  ok('Sem assinatura: mostra "Ver planos"', await ep.isVisible('text=Ver planos'));
  ok('Sem testes: estado vazio', await ep.isVisible('text=Ainda não fez nenhum teste'));
  ok('Sem actividade: mensagem no gráfico', await ep.isVisible('text=Ainda sem aulas concluídas esta semana.'));
  ok('Média mostra "—" sem testes', await ep.isVisible('text=—'));
  await ep.screenshot({ path: `${S}/f4-painel-vazio.png`, fullPage: true });
  await e.close();

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 400));
  await b.close();
  finish();
})().catch((e) => finish(e));
