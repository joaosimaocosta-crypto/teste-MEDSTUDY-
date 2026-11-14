// MEDSTUDY MOZ — testes de ponta a ponta: testes
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { chromium, devices, S, BASE, ok, sql, V, sleep, waitText, createUser, login, newContext, finish } = require("./lib/helpers.cjs");
const SUBJECT = '20000000-0000-0000-0000-000000000001';

(async () => {
  const t = Date.now();
  const SECRET_EXPL = `EXPLICACAO${t}`;
  const adminEmail = `qadmin${t}@teste.local`, paidEmail = `qpaid${t}@teste.local`, otherEmail = `qother${t}@teste.local`, freeEmail = `qfree${t}@teste.local`;
  const adminId = await createUser(adminEmail, 'Admin Testes'); sql(`update profiles set role='admin' where id='${adminId}'`);
  const paidId = await createUser(paidEmail, 'Assinante Testes');
  const otherId = await createUser(otherEmail, 'Outro Assinante');
  await createUser(freeEmail, 'Sem Assinatura');
  for (const id of [paidId, otherId]) sql(`insert into subscriptions (user_id, plan_id, status, starts_at, expires_at) values ('${id}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days')`);

  const b = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource|404/.test(m.text()) && errors.push(m.text())); };

  // ================= ADMIN =================
  const ac = await newContext(b, { viewport: { width: 1366, height: 900 } }); const a = await ac.newPage(); watch(a);
  await login(a, adminEmail);
  await a.goto(`${BASE}/admin/testes/novo`);
  await a.fill(V('input[name=title]'), `Avaliação Cardio ${t}`);
  await a.selectOption(V('select[name=subject_id]'), SUBJECT);
  await a.fill(V('input[name=time_limit_minutes]'), '10');
  await a.fill(V('input[name=passing_score]'), '60');
  await a.fill(V('input[name=max_attempts]'), '2');
  await a.selectOption(V('select[name=status]'), 'published');
  await a.click(V('button:has-text("Criar teste")'));
  ok('Não publica teste sem perguntas', await waitText(a, 'Adicione pelo menos uma pergunta'));
  await a.selectOption(V('select[name=status]'), 'draft');
  await a.click(V('button:has-text("Criar teste")'));
  await a.waitForURL(/\/admin\/testes\/[0-9a-f-]{36}\?criado=1/);
  const quizId = new URL(a.url()).pathname.split('/').pop();
  ok('Teste criado como rascunho', await waitText(a, 'Teste criado como rascunho'));

  const newQ = 'form:has(input[name=quizId]):not(:has(input[name=id]))';
  const qCount = () => Number(sql(`select count(*) from questions where quiz_id='${quizId}'`));
  async function fillQuestion(statement, opts, correct, expl, points = '1') {
    await a.fill(V(`${newQ} textarea[name=statement]`), statement);
    for (const [i, l] of ['a', 'b', 'c', 'd'].entries()) await a.fill(V(`${newQ} input[name=option_${l}]`), opts[i]);
    if (correct) await a.check(V(`${newQ} input[name=correct_option][value=${correct}]`));
    await a.fill(V(`${newQ} textarea[name=explanation]`), expl);
    await a.fill(V(`${newQ} input[name=points]`), points);
  }
  async function addQuestion(...args) {
    const before = qCount();
    await fillQuestion(...args);
    await a.click(V(`${newQ} button:has-text("Adicionar pergunta")`));
    for (let i = 0; i < 40 && qCount() === before; i++) await sleep(250);
    await a.waitForFunction(() => document.querySelector('form:has(input[name=quizId]):not(:has(input[name=id])) textarea[name=statement]')?.value === '', null, { timeout: 8000 }).catch(() => {});
    return qCount() > before;
  }
  // Validações (antes de marcar qualquer resposta correcta)
  await fillQuestion('Quantas câmaras tem o coração?', ['Duas', 'Três', 'Quatro', 'Cinco'], null, 'x');
  await a.click(V(`${newQ} button:has-text("Adicionar pergunta")`));
  ok('Exige indicar a resposta correcta', await waitText(a, 'Indique a resposta correcta.'));
  await fillQuestion('Quantas câmaras tem o coração?', ['Duas', 'Duas', 'Quatro', 'Cinco'], 'C', 'x');
  await a.click(V(`${newQ} button:has-text("Adicionar pergunta")`));
  ok('Rejeita alternativas repetidas', await waitText(a, 'As quatro alternativas devem ser diferentes.'));
  ok('Pergunta 1 adicionada', await addQuestion('Quantas câmaras tem o coração?', ['Duas', 'Três', 'Quatro', 'Cinco'], 'C', `${SECRET_EXPL} duas aurículas e dois ventrículos.`));
  ok('Formulário fica vazio para a próxima', (await a.inputValue(V(`${newQ} textarea[name=statement]`))) === '');
  await addQuestion('A sístole corresponde a:', ['Relaxamento', 'Contracção', 'Repouso', 'Enchimento'], 'A', 'Sístole é contracção.');
  await addQuestion('Que vaso sai do ventrículo esquerdo?', ['Aorta', 'Veia cava', 'Artéria pulmonar', 'Veia pulmonar'], 'A', 'A aorta.', '2');
  ok('3 perguntas na lista', qCount() === 3);

  // Editar a pergunta 2: resposta correcta passa a B
  await a.locator(V('li:has(button[aria-label="Editar pergunta"])')).nth(1).locator('button[aria-label="Editar pergunta"]').click();
  await a.check(V('form:has(input[name=id]) input[name=correct_option][value=B]'));
  await a.click(V('button:has-text("Guardar pergunta")'));
  ok('Editar pergunta guarda a nova resposta correcta', await waitText(a, 'Pergunta guardada.') && sql(`select correct_option from questions where quiz_id='${quizId}' and statement like 'A sístole%'`) === 'B');
  // Mover a pergunta 3 para cima
  await a.locator(V('li:has(button[aria-label="Editar pergunta"])')).nth(2).locator('button[aria-label="Mover para cima"]').click();
  const order = () => sql(`select string_agg(left(statement, 10), '|' order by position) from questions where quiz_id='${quizId}'`);
  for (let i = 0; i < 40 && order() !== 'Quantas câ|Que vaso s|A sístole'; i++) await sleep(250);
  ok('Reordenar perguntas', order() === 'Quantas câ|Que vaso s|A sístole', order());
  await a.selectOption(V('select[name=status]'), 'published');
  await a.click(V('button:has-text("Guardar alterações")'));
  ok('Teste publicado', await waitText(a, 'Teste guardado.'));
  await a.screenshot({ path: `${S}/f8-admin-teste.png`, fullPage: true });

  // ================= SEM ASSINATURA =================
  const fc = await newContext(b, { ...devices['Pixel 7'] }); const f = await fc.newPage(); watch(f);
  await login(f, freeEmail);
  await f.goto(`${BASE}/testes/${quizId}`);
  ok('Sem assinatura: teste bloqueado', await waitText(f, 'Teste exclusivo para assinantes'));
  await fc.close();

  // ================= ASSINANTE (telemóvel) =================
  const pc = await newContext(b, { ...devices['iPhone 13'] }); const p = await pc.newPage(); watch(p);
  await login(p, paidEmail);
  await p.goto(`${BASE}/testes`);
  ok('Catálogo lista o teste', await waitText(p, `Avaliação Cardio ${t}`));
  await p.click(V(`text=Avaliação Cardio ${t}`)); await p.waitForURL(`${BASE}/testes/${quizId}`);
  ok('Detalhe mostra regras (3 perguntas, 10 min, 60%, 0 de 2)', await waitText(p, '0 de 2') && await p.isVisible(V('text=10 min')) && await p.isVisible(V('text=60%')));
  await p.click(V('button:has-text("Iniciar teste")'));
  await p.waitForURL(/\/testes\/tentativas\/[0-9a-f-]{36}$/);
  const attempt1 = p.url().split('/').pop();
  ok('Tentativa iniciada com cronómetro', await waitText(p, 'Pergunta 1 de 3') && await p.isVisible(V('[role=timer]')));
  const html = await (await pc.request.get(p.url())).text();
  ok('Respostas certas/explicações NÃO chegam ao browser', !html.includes(SECRET_EXPL) && !html.includes('correct_option'));

  await p.click(V('label:has-text("Quatro")'));
  await p.reload(); await waitText(p, 'Pergunta 1 de 3');
  ok('Resposta mantém-se após recarregar a página', await p.locator(V('input[value=C]')).isChecked());
  await p.click(V('button:has-text("Seguinte")'));
  await p.click(V('label:has-text("Aorta")'));
  ok('Progresso "Respondidas 2 de 3"', await waitText(p, 'Respondidas 2 de 3'));
  ok('Ecrã do teste sem scroll horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.screenshot({ path: `${S}/f8-runner-mobile.png`, fullPage: true });
  await p.click(V('button[aria-label="Pergunta 3, por responder"]'));
  await p.click(V('button:has-text("Rever e submeter")'));
  ok('Aviso de pergunta por responder', await waitText(p, 'Tem 1 pergunta por responder'));
  await p.click(V('button:has-text("Submeter respostas")'));
  await p.waitForSelector(V('text=Correcção'), { timeout: 15000 });
  // Pergunta 1 (C, 1pt) certa; 2 = Aorta (2pt) certa; 3 sem resposta (1pt) → 3/4 = 75% ≥ 60%
  ok('Resultado 75% e Aprovado', await waitText(p, '75%') && await p.isVisible(V('text=Aprovado')));
  ok('Correcção mostra explicação e "Sem resposta"', await p.isVisible(V(`text=${SECRET_EXPL}`)) && await p.isVisible(V('text=Sem resposta')));
  ok('BD: nota 3/4', sql(`select score || '/' || max_score || '|' || status from quiz_attempts where id='${attempt1}'`) === '3/4|submitted');
  ok('Respostas locais apagadas após correcção', await p.evaluate(id => localStorage.getItem(`medstudy:tentativa:${id}`), attempt1) === null);
  await p.screenshot({ path: `${S}/f8-resultado-mobile.png`, fullPage: true });

  // Segunda tentativa com tempo a terminar → submissão automática
  await p.click(V('button:has-text("Tentar novamente")'));
  await p.waitForURL(u => /\/tentativas\//.test(u.toString()) && !u.toString().endsWith(attempt1));
  const attempt2 = p.url().split('/').pop();
  await waitText(p, 'Pergunta 1 de 3');
  await p.click(V('label:has-text("Duas")'));
  sql(`update quiz_attempts set expires_at = now() + interval '6 seconds' where id='${attempt2}'`);
  await p.reload(); await waitText(p, 'Pergunta 1 de 3');
  await p.waitForSelector(V('text=Correcção'), { timeout: 25000 }).catch(() => {});
  ok('Tempo esgotado → submissão automática', sql(`select status from quiz_attempts where id='${attempt2}'`) === 'submitted');
  ok('Resposta dada antes do fim foi considerada (0%)', await waitText(p, '0%') && await p.isVisible(V('text=Reprovado')));
  await p.goto(`${BASE}/testes/${quizId}`);
  ok('Máximo de 2 tentativas atingido', await waitText(p, 'Já utilizou todas as tentativas'));
  ok('Detalhe lista 2 tentativas e melhor 75%', (await p.locator(V('text=/Tentativa [12]/')).count()) === 2 && await p.isVisible(V('text=75%')));
  await p.goto(`${BASE}/testes`);
  ok('Histórico de tentativas no catálogo', await waitText(p, 'Histórico de tentativas') && (await p.locator(V(`a[href="/testes/tentativas/${attempt1}"]`)).count()) === 1);
  await pc.close();

  // ================= OUTRO ESTUDANTE =================
  const oc = await newContext(b); const o = await oc.newPage(); watch(o);
  await login(o, otherEmail);
  await o.goto(`${BASE}/testes/tentativas/${attempt1}`); await sleep(800);
  ok('Outro estudante não vê a tentativa alheia (404)', (await o.content()).includes('404'));
  await oc.close();

  // ================= ADMIN: estatísticas e protecção =================
  await a.goto(`${BASE}/admin/testes/${quizId}`);
  ok('Admin vê estatísticas (2 tentativas, 50% aprovados)', await waitText(a, '2 tentativas') && await a.isVisible(V('text=50% aprovados')));
  await a.click(V('button:has-text("Eliminar teste")')); await a.click(V('button:has-text("Eliminar definitivamente")'));
  ok('Não elimina teste com tentativas', await waitText(a, 'Para não apagar o histórico'));
  await a.goto(`${BASE}/admin/testes`);
  ok('Lista de testes (admin) mostra o nº de tentativas', await waitText(a, `Avaliação Cardio ${t}`) &&
    (await a.locator(V(`li:has-text("Avaliação Cardio ${t}")`)).textContent()).includes('2 tentativas'));
  await ac.close();

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 400));
  await b.close();
  finish();
})().catch((e) => finish(e));
