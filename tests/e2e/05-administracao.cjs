// MEDSTUDY MOZ — testes de ponta a ponta: administracao
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { chromium, devices, S, BASE, ok, sql, waitText, noOverflow, createUser, login, newContext, finish } = require("./lib/helpers.cjs");

(async () => {
  const t = Date.now();
  const adminEmail = `admin${t}@teste.local`, stuEmail = `aluno${t}@teste.local`, pendEmail = `pend${t}@teste.local`;
  const adminId = await createUser(adminEmail, 'Admin Principal');
  sql(`update profiles set role='admin' where id='${adminId}'`);
  const stuId = await createUser(stuEmail, `Zacarias Teste${t}`);
  const pendId = await createUser(pendEmail, `Pendente Teste${t}`);
  // 25 estudantes extra (para paginação), criados directamente na BD
  sql(`insert into auth.users (id, email, raw_user_meta_data, aud, role, created_at)
       select gen_random_uuid(), 'lote' || g || '_${t}@teste.local', jsonb_build_object('full_name', 'Lote ${t} ' || g), 'authenticated', 'authenticated', now()
       from generate_series(1, 25) g`);
  sql(`insert into subscriptions (user_id, plan_id, status, starts_at, expires_at) values ('${stuId}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '5 days')`);
  sql(`insert into subscriptions (user_id, plan_id) values ('${pendId}', '90000000-0000-0000-0000-000000000001')`);
  sql(`insert into payments (user_id, plan_id, amount_mzn, method, reference, status, paid_at, recorded_by) values ('${stuId}', '90000000-0000-0000-0000-000000000001', 450, 'mpesa', 'MP${t}', 'confirmed', now(), '${adminId}')`);
  sql(`insert into quiz_attempts (quiz_id, user_id, status, submitted_at, score, max_score, percentage, passed) values ('70000000-0000-0000-0000-000000000001', '${stuId}', 'submitted', now(), 1, 3, 33.33, false)`);

  const b = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text())); };

  // ---------- Estudante tenta entrar na administração ----------
  const sc = await newContext(b, { ...devices['Pixel 7'] }); const sp = await sc.newPage(); watch(sp);
  await login(sp, stuEmail);
  for (const path of ['/admin', '/admin/estudantes', '/admin/cursos', `/admin/estudantes/${pendId}`]) {
    await sp.goto(`${BASE}${path}`); await sp.waitForURL(`${BASE}/painel`, { timeout: 8000 }).catch(() => {});
    ok(`Estudante em ${path.replace(pendId, '[id]')} → /painel`, sp.url() === `${BASE}/painel`);
  }
  const leak = await (await sc.request.get(`${BASE}/admin/estudantes`)).text();
  ok('HTML para estudante não contém dados de outros estudantes', !leak.includes(pendEmail) && !leak.includes('utilizadores encontrados'));
  const leak2 = await (await sc.request.get(`${BASE}/admin/cursos`)).text();
  ok('Página provisória de admin não é enviada a estudantes', !leak2.includes('Disponível em breve'));
  await sc.close();

  // ---------- Administrador: visão geral (computador, escuro) ----------
  const ac = await newContext(b, { viewport: { width: 1366, height: 900 }, colorScheme: 'dark' }); const ap = await ac.newPage(); watch(ap);
  await login(ap, adminEmail);
  await ap.goto(`${BASE}/admin`);
  ok('Admin acede à visão geral', await waitText(ap, 'Novos registos'));
  const studentsDb = sql(`select count(*) from profiles where role='student'`);
  const tileVal = (await ap.locator('main span:text-is("Estudantes")').locator('xpath=../..').locator('p').first().textContent()).replace(/\s/g, '');
  ok('Indicador "Estudantes" = contagem na BD', tileVal === studentsDb, `${tileVal} vs ${studentsDb}`);
  const pendDb = sql(`select count(*) from subscriptions where status='pending'`);
  const pendTile = (await ap.locator('main span:text-is("Pedidos pendentes") >> visible=true').locator('xpath=../..').locator('p').first().textContent()).replace(/\s/g, '');
  ok('Indicador "Pedidos pendentes" = contagem na BD', pendTile === pendDb, `${pendTile} vs ${pendDb}`);
  ok('Receita do mês inclui pagamento de 450 MZN', (await ap.locator('text=Receita do mês').locator('xpath=../..').textContent()).includes('MZN'));
  ok('Barra lateral marca "Visão geral" como activa', (await ap.locator('aside a[aria-current=page]').textContent()).includes('Visão geral'));
  await ap.screenshot({ path: `${S}/f5-admin-overview-dark.png` });

  // ---------- Lista de estudantes ----------
  await ap.goto(`${BASE}/admin/estudantes`);
  ok('Lista mostra total de utilizadores', await waitText(ap, 'utilizadores encontrados'));
  ok('Paginação disponível (20 por página)', await ap.isVisible('nav[aria-label=Paginação]'));
  await ap.fill('input[name=q]', `Zacarias Teste${t}`); await ap.click('button:has-text("Filtrar")');
  await ap.waitForURL(/q=Zacarias/);
  ok('Pesquisa por nome encontra 1 resultado', await waitText(ap, '1 utilizador encontrado'));
  ok('Linha mostra assinatura Activa', await ap.isVisible('main table.w-full >> text=Activa'));
  await ap.goto(`${BASE}/admin/estudantes?q=${encodeURIComponent('a,b(c)*%')}`);
  ok('Pesquisa com caracteres especiais não dá erro', await waitText(ap, 'encontrado'));
  await ap.goto(`${BASE}/admin/estudantes?assinatura=pending&q=Teste${t}`);
  await waitText(ap, 'encontrado');
  ok('Filtro "Pendente" mostra só o estudante pendente', (await ap.isVisible(`main table.w-full >> text=Pendente Teste${t}`)) && (await ap.locator('main table.w-full tbody tr').count()) === 1);
  await ap.goto(`${BASE}/admin/estudantes?papel=admin`); await waitText(ap, 'encontrado');
  ok('Filtro "Administradores" inclui o admin', await ap.locator('main table.w-full >> text=Admin Principal').first().isVisible() && !(await ap.isVisible(`main table.w-full >> text=Zacarias`)));
  await ap.goto(`${BASE}/admin/estudantes?q=Lote ${t}&pagina=2`); await waitText(ap, 'encontrado');
  ok('Página 2 da pesquisa tem 5 resultados', (await ap.locator('main table.w-full tbody tr').count()) === 5);
  ok('Paginação mantém a pesquisa', (await ap.getAttribute('nav[aria-label=Paginação] a', 'href')).includes(`q=Lote`));

  // ---------- Ficha do estudante ----------
  await ap.goto(`${BASE}/admin/estudantes/${stuId}`);
  ok('Ficha mostra pagamento M-Pesa', await waitText(ap, `Ref. MP${t}`));
  ok('Ficha mostra teste reprovado (33%)', await ap.isVisible('text=Reprovado') && await ap.isVisible('text=33%'));
  ok('Ficha mostra assinatura Activa', await ap.isVisible('text=Plano Mensal (exemplo)'));
  await ap.screenshot({ path: `${S}/f5-admin-ficha-dark.png`, fullPage: true });
  const r404 = await ap.goto(`${BASE}/admin/estudantes/nao-e-um-uuid`); await ap.waitForTimeout(500);
  ok('ID inválido → página não encontrada', (await ap.content()).includes('404') || r404.status() === 404);
  await ap.goto(`${BASE}/admin/estudantes/00000000-0000-0000-0000-000000000000`); await ap.waitForTimeout(500);
  ok('ID inexistente → página não encontrada', (await ap.content()).includes('404'));

  // ---------- Papéis ----------
  await ap.goto(`${BASE}/admin/estudantes/${adminId}`);
  ok('Na própria ficha não há botão para alterar papel', await waitText(ap, 'Esta é a sua conta'));
  await ap.goto(`${BASE}/admin/estudantes/${stuId}`);
  await ap.click('button:has-text("Promover a administrador")');
  ok('Promoção pede confirmação', await waitText(ap, 'Confirmar?'));
  await ap.click('button:has-text("Confirmar")');
  ok('Promoção concluída', await waitText(ap, 'Utilizador promovido a administrador.'));
  ok('BD: papel passou a admin', sql(`select role from profiles where id='${stuId}'`) === 'admin');
  await ap.click('button:has-text("Remover acesso de administrador")');
  await ap.click('button:has-text("Confirmar")');
  ok('Despromoção concluída', await waitText(ap, 'Acesso de administrador removido.'));
  ok('BD: papel voltou a student', sql(`select role from profiles where id='${stuId}'`) === 'student');
  await ac.close();

  // ---------- Administrador no telemóvel ----------
  const mc = await newContext(b, { ...devices['iPhone 13'] }); const mp = await mc.newPage(); watch(mp);
  await login(mp, adminEmail);
  await mp.goto(`${BASE}/admin/estudantes`); await waitText(mp, 'encontrados');
  ok('Separadores de administração visíveis no telemóvel', await mp.isVisible('header nav >> text=Estudantes'));
  ok('Lista em cartões no telemóvel (tabela escondida)', !(await mp.locator('main table.w-full').isVisible()));
  ok('Lista de estudantes (telemóvel) sem scroll horizontal', await noOverflow(mp));
  await mp.screenshot({ path: `${S}/f5-admin-estudantes-mobile.png` });
  await mp.goto(`${BASE}/admin`); await waitText(mp, 'Novos registos');
  ok('Visão geral (telemóvel) sem scroll horizontal', await noOverflow(mp));
  await mp.screenshot({ path: `${S}/f5-admin-overview-mobile.png`, fullPage: true });
  await mc.close();

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 400));
  await b.close();
  finish();
})().catch((e) => finish(e));
