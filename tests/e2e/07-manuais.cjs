// MEDSTUDY MOZ — testes de ponta a ponta: manuais
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { chromium, devices, request: pwRequest, S, BASE, ok, sql, V, waitText, createUser, login, newContext, finish } = require("./lib/helpers.cjs");
const COURSE = '10000000-0000-0000-0000-000000000001', SUBJECT = '20000000-0000-0000-0000-000000000001';
const newManual = (title, url, status = 'published') =>
  sql(`insert into manuals (course_id, title, pdf_url, status) values ('${COURSE}', '${title}', '${url}', '${status}') returning id`).split('\n')[0];

(async () => {
  const t = Date.now();
  const adminEmail = `madmin${t}@teste.local`, freeEmail = `mfree${t}@teste.local`, paidEmail = `mpaid${t}@teste.local`;
  const adminId = await createUser(adminEmail, 'Admin Manuais'); sql(`update profiles set role='admin' where id='${adminId}'`);
  await createUser(freeEmail, 'Sem Assinatura');
  const paidId = await createUser(paidEmail, 'Com Assinatura');
  sql(`insert into subscriptions (user_id, plan_id, status, starts_at, expires_at) values ('${paidId}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days')`);
  const mHtml = newManual(`Não PDF ${t}`, 'https://localhost:8443/pagina.html');
  const mPrivate = newManual(`IP privado ${t}`, 'https://127.0.0.1:8443/manual.pdf');
  const mRedir = newManual(`Redireccionamento ${t}`, 'https://localhost:8443/redir');
  const mDraft = newManual(`Rascunho ${t}`, 'https://localhost:8443/manual.pdf', 'draft');

  const b = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource|404|403|502/.test(m.text()) && errors.push(m.text())); };

  // ================= ADMIN: criar manual =================
  const ac = await newContext(b, { viewport: { width: 1366, height: 900 } }); const a = await ac.newPage(); watch(a);
  await login(a, adminEmail);
  await a.goto(`${BASE}/admin/manuais/novo`);
  await a.fill(V('input[name=title]'), `Manual de Anatomia ${t}`);
  await a.fill(V('textarea[name=description]'), 'Manual oficial de teste.');
  await a.selectOption(V('select[name=subject_id]'), SUBJECT);
  await a.fill(V('input[name=pdf_url]'), 'http://localhost:8443/manual.pdf');
  await a.click(V('button:has-text("Criar manual")'));
  ok('Endereço sem https é rejeitado', await waitText(a, 'O endereço tem de começar por https://'));
  ok('Disciplina mantida após erro', (await a.inputValue(V('select[name=subject_id]'))) === SUBJECT);
  await a.fill(V('input[name=pdf_url]'), 'https://localhost:8443/manual.pdf');
  await a.fill(V('input[name=page_count]'), '5');
  await a.click(V('button:has-text("Criar manual")'));
  await a.waitForURL(/\/admin\/manuais\/[0-9a-f-]{36}\?criado=1/);
  const mId = new URL(a.url()).pathname.split('/').pop();
  ok('Manual criado (rascunho) e página de edição aberta', await waitText(a, 'Manual criado.'));
  ok('Pré-visualização do admin carrega o PDF (5 páginas)', await waitText(a, 'de 5', 20000));
  ok('Admin vê o endereço real no formulário', (await a.inputValue(V('input[name=pdf_url]'))) === 'https://localhost:8443/manual.pdf');
  await a.selectOption(V('select[name=status]'), 'published');
  await a.click(V('button:has-text("Guardar alterações")'));
  ok('Manual publicado', await waitText(a, 'Manual guardado.'));
  ok('Após guardar, Estado continua "Publicado"', (await a.inputValue(V('select[name=status]'))) === 'published');
  ok('BD: publicado com data de publicação', sql(`select status || '|' || (published_at is not null) from manuals where id='${mId}'`) === 'published|true');
  await a.goto(`${BASE}/admin/manuais?q=${encodeURIComponent('Anatomia ' + t)}`);
  ok('Lista de admin encontra o manual', await waitText(a, `Manual de Anatomia ${t}`));
  await ac.close();

  // ================= SEM SESSÃO =================
  const anon = await pwRequest.newContext();
  ok('Sem sessão: /api/manuals → 401', (await anon.get(`${BASE}/api/manuals/${mId}`)).status() === 401);
  ok('ID inválido → 404', (await anon.get(`${BASE}/api/manuals/abc`)).status() === 404);
  await anon.dispose();

  // ================= ESTUDANTE SEM ASSINATURA =================
  const fc = await newContext(b, { ...devices['Pixel 7'] }); const f = await fc.newPage(); watch(f);
  await login(f, freeEmail);
  await f.goto(`${BASE}/manuais?q=${encodeURIComponent('Anatomia ' + t)}`);
  ok('Biblioteca lista o manual com cadeado', await waitText(f, `Manual de Anatomia ${t}`) && await f.locator(V('[aria-label="Requer assinatura"]')).count() >= 1);
  await f.goto(`${BASE}/manuais/${mId}`);
  ok('Página do manual mostra aviso de assinatura', await waitText(f, 'Manual exclusivo para assinantes'));
  ok('Sem assinatura: /api/manuals → 403', (await fc.request.get(`${BASE}/api/manuals/${mId}`)).status() === 403);
  ok('Rascunho: /api/manuals → 404 para estudante', (await fc.request.get(`${BASE}/api/manuals/${mDraft}`)).status() === 404);
  const htmlF = await (await fc.request.get(`${BASE}/manuais/${mId}`)).text();
  ok('HTML não contém o endereço real do PDF', !htmlF.includes('localhost:8443'));
  await f.screenshot({ path: `${S}/f7-bloqueado-mobile.png` });
  await fc.close();

  // ================= ESTUDANTE COM ASSINATURA (telemóvel) =================
  const pc = await newContext(b, { ...devices['iPhone 13'] }); const p = await pc.newPage(); watch(p);
  const requested = []; p.on('request', r => requested.push(r.url()));
  await login(p, paidEmail);
  await p.goto(`${BASE}/manuais`);
  await waitText(p, `Manual de Anatomia ${t}`);
  await p.click(V(`text=Manual de Anatomia ${t}`)); await p.waitForURL(`${BASE}/manuais/${mId}`);
  ok('Visualizador abre: "Página 1 de 5"', await waitText(p, 'de 5', 20000));
  await p.waitForFunction(() => document.querySelectorAll('canvas[aria-label="Página 1"]').length && document.querySelector('canvas[aria-label="Página 1"]').width > 0, null, { timeout: 15000 }).catch(() => {});
  const c1 = await p.evaluate(() => { const c = document.querySelector('canvas[aria-label="Página 1"]'); return c ? { w: c.width, cssW: parseInt(c.style.width), vw: innerWidth } : null; });
  ok('Página 1 desenhada e ajustada à largura do ecrã', !!c1 && c1.w > 0 && c1.cssW <= c1.vw, JSON.stringify(c1));
  ok('Página sem scroll horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok('Browser nunca pede o PDF directamente à Lunes Host', !requested.some(u => u.includes(':8443')));
  ok('Browser usa a rota protegida', requested.some(u => u.includes(`/api/manuals/${mId}`)));
  await p.screenshot({ path: `${S}/f7-viewer-mobile.png` });
  await p.click(V('button[aria-label="Aumentar zoom"]'));
  ok('Zoom aumenta para 125%', await waitText(p, '125%'));
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  ok('Indicador de página acompanha o scroll', await p.waitForFunction(() => /Página\s*[2-5]\s*de 5/.test(document.querySelector('[role=toolbar]')?.textContent ?? ''), null, { timeout: 8000 }).then(() => true).catch(() => false));

  const full = await pc.request.get(`${BASE}/api/manuals/${mId}`);
  ok('Rota devolve application/pdf, privado, inline', full.status() === 200 && full.headers()['content-type'] === 'application/pdf' && full.headers()['cache-control'].startsWith('private') && full.headers()['content-disposition'].startsWith('inline'));
  ok('PDF completo tem os bytes certos', (await full.body()).subarray(0, 5).toString() === '%PDF-');
  const part = await pc.request.get(`${BASE}/api/manuals/${mId}`, { headers: { Range: 'bytes=0-99' } });
  ok('Pedido parcial (Range) → 206 com 100 bytes', part.status() === 206 && (await part.body()).length === 100 && /^bytes 0-99\//.test(part.headers()['content-range']));
  ok('Resposta não revela o endereço real', !JSON.stringify(full.headers()).includes('8443'));

  // Erros / SSRF
  ok('Ficheiro que não é PDF → 502', (await pc.request.get(`${BASE}/api/manuals/${mHtml}`)).status() === 502);
  ok('SSRF: IP fora da lista autorizada → 502', (await pc.request.get(`${BASE}/api/manuals/${mPrivate}`)).status() === 502);
  ok('SSRF: redireccionamento para IP → 502', (await pc.request.get(`${BASE}/api/manuals/${mRedir}`)).status() === 502);
  await p.goto(`${BASE}/manuais/${mHtml}`);
  ok('Visualizador mostra erro amigável', await waitText(p, 'Não foi possível carregar o manual', 15000));
  await pc.close();

  // Desktop escuro (screenshot)
  const dc = await newContext(b, { viewport: { width: 1366, height: 900 }, colorScheme: 'dark' }); const d = await dc.newPage(); watch(d);
  await login(d, paidEmail);
  await d.goto(`${BASE}/manuais`); await waitText(d, `Manual de Anatomia ${t}`);
  await d.screenshot({ path: `${S}/f7-biblioteca-dark.png` });
  await d.goto(`${BASE}/manuais/${mId}`); await waitText(d, 'de 5', 20000); await d.waitForTimeout(1500);
  await d.screenshot({ path: `${S}/f7-viewer-desktop-dark.png` });
  await dc.close();

  const lunesLog = await (await fetch('https://localhost:8443/__log')).json().catch(() => []);
  ok('Lunes recebeu pedidos com Range (leitura por partes)', lunesLog.some(l => /range=bytes=/.test(l)), `${lunesLog.length} pedidos`);

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 400));
  await b.close();
  finish();
})().catch((e) => finish(e));
