// MEDSTUDY MOZ — testes de ponta a ponta: assinaturas
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { chromium, devices, S, BASE, ok, sql, V, sleep, waitText, createUser, login, newContext, finish } = require("./lib/helpers.cjs");
const poll = async (fn, want, n = 40) => { for (let i = 0; i < n && fn() !== want; i++) await sleep(250); return fn(); };
const PAID_LESSON = `${BASE}/aulas/50000000-0000-0000-0000-000000000002`;

(async () => {
  const t = Date.now();
  const PLAN = `Plano TMG ${t}`;
  const adminEmail = `sadmin${t}@teste.local`, stuEmail = `sstu${t}@teste.local`, otherEmail = `sother${t}@teste.local`;
  const adminId = await createUser(adminEmail, 'Admin Assinaturas'); sql(`update profiles set role='admin' where id='${adminId}'`);
  const stuId = await createUser(stuEmail, 'Estudante Assinatura');
  const otherId = await createUser(otherEmail, 'Outro Estudante');

  const b = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource|404/.test(m.text()) && errors.push(m.text())); };

  // ================= ADMIN: planos e instruções =================
  const ac = await newContext(b, { viewport: { width: 1366, height: 900 } }); const a = await ac.newPage(); watch(a);
  await login(a, adminEmail);
  await a.goto(`${BASE}/admin/planos`);
  const newPlan = 'form:has(button:has-text("Criar plano"))';
  await a.fill(V(`${newPlan} input[name=name]`), PLAN);
  await a.fill(V(`${newPlan} input[name=price_mzn]`), '-5');
  await a.click(V(`${newPlan} button:has-text("Criar plano")`));
  ok('Preço negativo é rejeitado', await waitText(a, 'O valor não pode ser negativo.'));
  await a.fill(V(`${newPlan} input[name=price_mzn]`), '500');
  await a.fill(V(`${newPlan} textarea[name=features]`), 'Todas as aulas\nManuais em PDF\nTestes com correcção');
  await a.click(V(`${newPlan} button:has-text("Criar plano")`));
  ok('Plano criado', await waitText(a, 'Plano criado.') && (await poll(() => sql(`select count(*) from subscription_plans where name='${PLAN}'`), '1')) === '1');
  const planId = sql(`select id from subscription_plans where name='${PLAN}'`);
  ok('Benefícios guardados como lista', sql(`select array_length(features, 1) from subscription_plans where id='${planId}'`) === '3');
  // Editar preço
  await a.click(V(`button[aria-label="Editar ${PLAN}"]`));
  await a.fill(V(`form:has(input[name=id][value="${planId}"]) input[name=price_mzn]`), '450,00');
  await a.click(V('button:has-text("Guardar plano")'));
  ok('Editar plano (preço 450,00)', await waitText(a, 'Plano guardado.') && (await poll(() => sql(`select price_mzn from subscription_plans where id='${planId}'`), '450.00')) === '450.00');
  // Instruções
  await a.fill(V('textarea[name=payment_instructions]'), `**M-Pesa (teste ${t}):** envie para o número de teste e indique o seu e-mail.`);
  await a.fill(V('input[name=support_contact]'), 'suporte de teste');
  await a.click(V('button:has-text("Guardar instruções")'));
  ok('Instruções de pagamento guardadas', await waitText(a, 'Instruções guardadas.'));
  await a.screenshot({ path: `${S}/f10-admin-planos.png`, fullPage: true });

  // ================= ESTUDANTE: pedir plano =================
  const mc = await newContext(b, { ...devices['iPhone 13'] }); const m = await mc.newPage(); watch(m);
  await login(m, stuEmail);
  await m.goto(`${BASE}/assinatura`);
  ok('Sem assinatura: mensagem inicial', await waitText(m, 'Ainda não tem nenhuma assinatura'));
  ok('Instruções em Markdown (negrito)', await m.locator(V(`strong:has-text("M-Pesa (teste ${t}):")`)).count() === 1);
  ok('Plano novo listado com preço e benefícios', await m.isVisible(V(`text=${PLAN}`)) && await m.isVisible(V('text=450,00 MZN')));
  const card = m.locator(V(`article:has-text("${PLAN}")`));
  await card.locator('button:has-text("Escolher este plano")').click();
  await card.locator('textarea[name=notes]').fill(`MPESA-REF-${t}`);
  await card.locator('button:has-text("Enviar pedido")').click();
  ok('Pedido enviado', await waitText(m, 'Pedido enviado!'));
  ok('BD: pedido pendente com referência', (await poll(() => sql(`select status || '|' || notes from subscriptions where user_id='${stuId}'`), `pending|MPESA-REF-${t}`)) === `pending|MPESA-REF-${t}`);
  await m.reload();
  ok('Estado mostra "Pedido pendente"', await waitText(m, 'Pedido pendente'));
  ok('Não permite segundo pedido', await m.isVisible(V('text=Já tem um pedido pendente.')));
  ok('Página Assinatura (telemóvel) sem scroll horizontal', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await m.screenshot({ path: `${S}/f10-estudante-pendente.png`, fullPage: true });
  await m.goto(`${BASE}/painel`);
  ok('Dashboard: "Pedido de assinatura em análise"', await waitText(m, 'Pedido de assinatura em análise'));
  await m.goto(PAID_LESSON);
  ok('Pendente: aula paga continua bloqueada', await waitText(m, 'Aula exclusiva para assinantes'));
  await m.goto(`${BASE}/admin/assinaturas`); await m.waitForURL(`${BASE}/painel`, { timeout: 8000 }).catch(() => {});
  ok('Estudante não acede à gestão de assinaturas', m.url() === `${BASE}/painel`);

  // ================= ADMIN: activar =================
  await a.goto(`${BASE}/admin/assinaturas?estado=pending&q=${encodeURIComponent('Estudante Assinatura')}`);
  ok('Pedido aparece em Pendentes com a referência', await waitText(a, `MPESA-REF-${t}`));
  const row = a.locator(V(`li:has-text("${stuEmail}")`));
  await row.locator('button:has-text("Activar")').click();
  await row.locator('button:has-text("Confirmar")').click();
  ok('Activação confirmada', (await poll(() => sql(`select status from subscriptions where user_id='${stuId}'`), 'active')) === 'active');
  ok('BD: validade de 30 dias e quem activou', sql(`select (expires_at - starts_at = interval '30 days') || '|' || (activated_by = '${adminId}') from subscriptions where user_id='${stuId}'`) === 'true|true');

  await m.goto(PAID_LESSON);
  ok('Activa: estudante acede à aula paga', await waitText(m, 'sístole'));
  await m.goto(`${BASE}/assinatura`);
  ok('Estado "Activa" com 30 dias restantes', await waitText(m, '30 dias restantes'));

  // ================= ADMIN: suspender e reactivar =================
  await a.goto(`${BASE}/admin/assinaturas?estado=active&q=${encodeURIComponent('Estudante Assinatura')}`);
  const row2 = a.locator(V(`li:has-text("${stuEmail}")`));
  await row2.locator('button:has-text("Suspender")').click();
  await row2.locator('input[name=reason]').fill('Pagamento em verificação');
  await row2.locator('button:has-text("Confirmar")').click();
  ok('Suspensa', (await poll(() => sql(`select status from subscriptions where user_id='${stuId}'`), 'suspended')) === 'suspended');
  await m.goto(PAID_LESSON);
  ok('Suspensa: acesso cortado de imediato', await waitText(m, 'Aula exclusiva para assinantes'));
  await a.goto(`${BASE}/admin/assinaturas?estado=suspended&q=${encodeURIComponent('Estudante Assinatura')}`);
  const row3 = a.locator(V(`li:has-text("${stuEmail}")`));
  ok('Motivo da suspensão visível', await row3.locator('text=/Suspensa\] Pagamento em verificação/').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
  await row3.locator('button:has-text("Levantar suspensão")').click();
  await row3.locator('button:has-text("Confirmar")').click();
  ok('Suspensão levantada', (await poll(() => sql(`select status from subscriptions where user_id='${stuId}'`), 'active')) === 'active');
  await m.goto(PAID_LESSON);
  ok('Acesso de volta', await waitText(m, 'sístole'));

  // ================= ADMIN: pagamentos =================
  const expBefore = sql(`select expires_at from subscriptions where user_id='${stuId}'`);
  await a.goto(`${BASE}/admin/pagamentos`);
  await a.fill(V('input[name=email]'), `naoexiste${t}@teste.local`);
  await a.selectOption(V('select[name=plan_id]'), planId);
  await a.click(V('button:has-text("Registar pagamento")'));
  ok('E-mail desconhecido é rejeitado', await waitText(a, 'Não existe nenhum utilizador com este e-mail.'));
  await a.fill(V('input[name=email]'), stuEmail);
  ok('Valor preenchido com o preço do plano', (await a.inputValue(V('input[name=amount_mzn]'))) === '450');
  await a.fill(V('input[name=reference]'), `PAG-${t}`);
  await a.click(V('button:has-text("Registar pagamento")'));
  ok('Pagamento registado e assinatura renovada', await waitText(a, 'Pagamento registado e assinatura renovada.'));
  ok('BD: +30 dias a partir do fim da validade', sql(`select expires_at = ('${expBefore}'::timestamptz + interval '30 days') from subscriptions where user_id='${stuId}'`) === 't');
  ok('BD: pagamento confirmado, 450 MZN, M-Pesa', sql(`select status || '|' || amount_mzn || '|' || method from payments where reference='PAG-${t}'`) === 'confirmed|450.00|mpesa');
  await a.goto(`${BASE}/admin/pagamentos?q=${encodeURIComponent('Estudante Assinatura')}`);
  ok('Pagamento listado com total', await waitText(a, `Ref. PAG-${t}`) && await a.isVisible(V('text=/total confirmado/')));
  await a.screenshot({ path: `${S}/f10-admin-pagamentos.png`, fullPage: true });
  await a.locator(V(`li:has-text("PAG-${t}")`)).locator('button:has-text("Anular")').click();
  ok('Anular pagamento', (await poll(() => sql(`select status from payments where reference='PAG-${t}'`), 'rejected')) === 'rejected');

  await m.goto(`${BASE}/assinatura`);
  ok('Estudante vê o pagamento no histórico', await waitText(m, `Ref. PAG-${t}`));

  // ================= ADMIN: atribuir plano na ficha + planos =================
  await a.goto(`${BASE}/admin/estudantes/${otherId}`);
  await a.selectOption(V('form:has(input[name=user_id]) select[name=plan_id]'), planId);
  await a.click(V('button:has-text("Atribuir")'));
  ok('Atribuir plano na ficha do estudante', await waitText(a, 'Plano atribuído e activado.') && sql(`select status from subscriptions where user_id='${otherId}'`) === 'active');
  await a.screenshot({ path: `${S}/f10-admin-ficha.png`, fullPage: true });

  await a.goto(`${BASE}/admin/planos`);
  await a.click(V(`button[aria-label="Eliminar ${PLAN}"]`));
  await a.click(V(`form:has(input[name=id][value="${planId}"]) button:has-text("Eliminar")`));
  ok('Não elimina plano com assinaturas', await waitText(a, 'Desactive-o em vez de eliminar'));
  // Desactivar → deixa de aparecer aos estudantes
  sql(`update subscription_plans set is_active = false where id='${planId}'`);
  await m.goto(`${BASE}/assinatura`);
  await waitText(m, 'Como pagar');
  ok('Plano inactivo não aparece aos estudantes', !(await m.isVisible(V(`article:has-text("${PLAN}")`))));
  await mc.close(); await ac.close();

  // Admin no telemóvel
  const amc = await newContext(b, { ...devices['Pixel 7'] }); const am = await amc.newPage(); watch(am);
  await login(am, adminEmail);
  await am.goto(`${BASE}/admin/assinaturas?estado=active`); await waitText(am, 'Activas');
  ok('Assinaturas (admin, telemóvel) sem scroll horizontal', await am.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await am.screenshot({ path: `${S}/f10-admin-assinaturas-mobile.png` });
  await amc.close();

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 400));
  await b.close();
  finish();
})().catch((e) => finish(e));
