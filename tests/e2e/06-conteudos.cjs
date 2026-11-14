// MEDSTUDY MOZ — testes de ponta a ponta: conteudos
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { chromium, devices, S, BASE, ok, sql, sleep, waitText, noOverflow, createUser, login, newContext, finish } = require("./lib/helpers.cjs");
const idFromUrl = u => u.split('/').pop();

(async () => {
  const t = Date.now();
  const adminEmail = `cadmin${t}@teste.local`, freeEmail = `cfree${t}@teste.local`, paidEmail = `cpaid${t}@teste.local`;
  const adminId = await createUser(adminEmail, 'Admin Conteúdos'); sql(`update profiles set role='admin' where id='${adminId}'`);
  await createUser(freeEmail, 'Estudante Gratuito');
  const paidId = await createUser(paidEmail, 'Estudante Assinante');
  sql(`insert into subscriptions (user_id, plan_id, status, starts_at, expires_at) values ('${paidId}', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days')`);
  const SECRET = `SEGREDO${t}`;

  const b = await chromium.launch();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text())); };

  // ======================= ADMINISTRADOR =======================
  const ac = await newContext(b, { viewport: { width: 1366, height: 900 } }); const a = await ac.newPage(); watch(a);
  await login(a, adminEmail);
  await a.goto(`${BASE}/admin/cursos`);
  ok('Lista de cursos mostra o curso do seed', await waitText(a, 'Técnico de Medicina Geral'));

  // Criar curso
  await a.fill('input[name=title] >> visible=true', `Curso Teste ${t}`); await a.click('button[aria-label="Adicionar curso"] >> visible=true');
  await a.waitForURL(/\/admin\/cursos\/[0-9a-f-]{36}$/); const courseId = idFromUrl(a.url());
  ok('Criar curso abre a página de edição como Rascunho', await waitText(a, 'Rascunho'));
  ok('Slug gerado automaticamente', (await a.inputValue('input[name=slug] >> visible=true')) === `curso-teste-${t}`);

  // Slug inválido
  await a.fill('input[name=slug] >> visible=true', 'Slug Inválido!'); await a.click('button:has-text("Guardar alterações") >> visible=true');
  ok('Slug inválido é rejeitado', await waitText(a, 'Use apenas letras minúsculas'));
  await a.fill('input[name=slug] >> visible=true', `curso-teste-${t}`);
  await a.fill('textarea[name=description] >> visible=true', 'Curso criado no teste automático.');
  await a.selectOption('select[name=status] >> visible=true', 'published');
  await a.click('button:has-text("Guardar alterações") >> visible=true');
  ok('Curso publicado e guardado', await waitText(a, 'Alterações guardadas.'));
  ok('BD: curso publicado', sql(`select status from courses where id='${courseId}'`) === 'published');

  // Criar hierarquia: disciplina → módulo → capítulo → aulas (e publicar cada nível)
  async function addChild(label, title) {
    const before = a.url();
    await a.fill(`form:has(button[aria-label="Adicionar ${label}"]) input[name=title] >> visible=true`, title);
    await a.click(`button[aria-label="Adicionar ${label}"] >> visible=true`);
    await a.waitForURL(u => u.toString() !== before);
    await a.waitForSelector(`h1:has-text("${title}") >> visible=true`);
    return idFromUrl(a.url());
  }
  async function publish() {
    await a.selectOption('select[name=status] >> visible=true', 'published'); await a.click('button:has-text("Guardar alterações") >> visible=true');
    await waitText(a, 'Alterações guardadas.');
  }
  await addChild('disciplina', `Farmacologia Clínica ${t}`); await publish();
  await addChild('módulo', 'Introdução'); await publish();
  const chapterId = await addChild('capítulo', 'Conceitos base'); await publish();
  ok('Breadcrumb do capítulo mostra o caminho completo', (await a.locator('nav[aria-label=Caminho] >> visible=true').textContent()).includes(`Farmacologia Clínica ${t}`));
  ok('Menu "Cursos" activo em páginas de capítulo', (await a.locator('aside a[aria-current=page] >> visible=true').textContent()).includes('Cursos'));

  const lessonA = await addChild('aula', 'Vias de administração');
  // Editar aula paga com conteúdo, vídeo, duração e tentativa de XSS
  await a.fill('textarea[name=content] >> visible=true', `# Vias de administração\n\n${SECRET}\n\n## Oral\n\n- Comprimidos\n- Xaropes\n\n<script>window.__xss = 1</script>\n\n[clique](javascript:alert(1))`);
  await a.fill('input[name=video_url] >> visible=true', 'http://youtube.com/watch?v=abc');
  await a.click('button:has-text("Guardar alterações") >> visible=true');
  ok('Vídeo sem https é rejeitado', await waitText(a, 'O endereço tem de começar por https://'));
  await a.fill('input[name=video_url] >> visible=true', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await a.fill('input[name=duration_minutes] >> visible=true', '20');
  await a.click('button:has-text("Pré-visualizar") >> visible=true');
  ok('Pré-visualização do Markdown funciona', await a.locator('h2:has-text("Oral") >> visible=true').isVisible());
  await a.selectOption('select[name=status] >> visible=true', 'published');
  await a.click('button:has-text("Guardar alterações") >> visible=true');
  ok('Aula guardada e publicada', await waitText(a, 'Alterações guardadas.'));
  ok('Após guardar, o campo Estado mostra "Publicado"', (await a.inputValue('select[name=status] >> visible=true')) === 'published');
  await a.fill('input[name=duration_minutes] >> visible=true', '20');
  await a.click('button:has-text("Guardar alterações") >> visible=true');
  await a.waitForTimeout(1500);
  ok('Guardar de novo NÃO despublica a aula', sql(`select status from lessons where id='${lessonA}'`) === 'published');
  ok('BD: duração e vídeo guardados', sql(`select duration_minutes || '|' || video_url from lessons where id='${lessonA}'`) === '20|https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  // Recursos
  await a.fill('form:has(input[name=lessonId]) input[name=title] >> visible=true', 'Tabela de doses');
  await a.fill('form:has(input[name=lessonId]) input[name=url] >> visible=true', 'javascript:alert(1)');
  await a.click('button:has-text("Adicionar recurso") >> visible=true');
  ok('Recurso com endereço perigoso é rejeitado', await waitText(a, 'Endereço inválido') || await waitText(a, 'https://', 2000));
  await a.fill('form:has(input[name=lessonId]) input[name=title] >> visible=true', 'Tabela de doses');
  await a.fill('form:has(input[name=lessonId]) input[name=url] >> visible=true', 'https://exemplo.invalid/doses.pdf');
  await a.selectOption('select[name=type] >> visible=true', 'pdf');
  await a.click('button:has-text("Adicionar recurso") >> visible=true');
  ok('Recurso adicionado', await waitText(a, 'Recurso adicionado.'));
  await a.screenshot({ path: `${S}/f6-admin-aula.png`, fullPage: true });

  // Segunda e terceira aula (mesmo título → slug único)
  await a.goto(`${BASE}/admin/capitulos/${chapterId}`);
  await addChild('aula', 'Absorção');
  await a.check('input[name=is_free_preview] >> visible=true'); await publish();
  await a.goto(`${BASE}/admin/capitulos/${chapterId}`);
  const lessonC = await addChild('aula', 'Absorção');
  ok('Título repetido gera slug único (-2)', (await a.inputValue('input[name=slug] >> visible=true')) === 'absorcao-2');

  // Reordenar: mover "Absorção" (2.º) para cima
  await a.goto(`${BASE}/admin/capitulos/${chapterId}`);
  const before = sql(`select string_agg(title, ',' order by position) from lessons where chapter_id='${chapterId}'`);
  await a.locator('li:has(button[aria-label="Mover para cima"]) >> visible=true').nth(1).locator('button[aria-label="Mover para cima"]').click();
  await sleep(1200);
  const after = sql(`select string_agg(title, ',' order by position) from lessons where chapter_id='${chapterId}'`);
  ok('Reordenar aulas altera a ordem na BD', before === 'Vias de administração,Absorção,Absorção' && after === 'Absorção,Vias de administração,Absorção', `${before} → ${after}`);
  await a.screenshot({ path: `${S}/f6-admin-capitulo.png`, fullPage: true });

  // Eliminar: capítulo com aulas → bloqueado; aula vazia → eliminada
  await a.click('button:has-text("Eliminar capítulo") >> visible=true'); await a.click('button:has-text("Eliminar definitivamente") >> visible=true');
  ok('Não elimina capítulo que tem aulas', await waitText(a, 'Não é possível eliminar: ainda contém 3 aulas'));
  await a.goto(`${BASE}/admin/aulas/${lessonC}`);
  await a.click('button:has-text("Eliminar aula") >> visible=true'); await a.click('button:has-text("Eliminar definitivamente") >> visible=true');
  await a.waitForURL(`${BASE}/admin/capitulos/${chapterId}`);
  ok('Eliminar aula volta ao capítulo e remove da BD', sql(`select count(*) from lessons where id='${lessonC}'`) === '0');
  await ac.close();

  // ======================= ESTUDANTE SEM ASSINATURA (telemóvel) =======================
  const fc = await newContext(b, { ...devices['iPhone 13'] }); const f = await fc.newPage(); watch(f);
  await login(f, freeEmail);
  await f.goto(`${BASE}/cursos`);
  ok('Catálogo mostra o curso novo', await waitText(f, `Curso Teste ${t}`));
  await f.click(`text=Curso Teste ${t} >> visible=true`); await f.waitForURL(`${BASE}/cursos/curso-teste-${t}`);
  ok('Página do curso lista a disciplina', await waitText(f, `Farmacologia Clínica ${t}`));
  await f.click(`text=Farmacologia Clínica ${t} >> visible=true`); await f.waitForURL(/\/cursos\/curso-teste-\d+\/farmacologia/);
  ok('Índice mostra módulo e capítulo', await waitText(f, 'Módulo 1 · Introdução') && await f.isVisible('text=Conceitos base >> visible=true'));
  ok('Aula paga aparece bloqueada', await f.locator('[aria-label="Bloqueada — requer assinatura"] >> visible=true').count() === 1);
  ok('Aula gratuita marcada "Grátis"', await f.isVisible('text=Grátis >> visible=true'));
  ok('Índice (telemóvel) sem scroll horizontal', await noOverflow(f));
  await f.screenshot({ path: `${S}/f6-indice-mobile.png`, fullPage: true });

  await f.goto(`${BASE}/aulas/${lessonA}`);
  ok('Aula paga mostra aviso de assinatura', await waitText(f, 'Aula exclusiva para assinantes'));
  const html = await (await fc.request.get(`${BASE}/aulas/${lessonA}`)).text();
  ok('HTML da aula bloqueada NÃO contém o conteúdo', !html.includes(SECRET));
  await f.screenshot({ path: `${S}/f6-aula-bloqueada.png` });

  await f.goto(`${BASE}/aulas/50000000-0000-0000-0000-000000000001`);
  ok('Aula gratuita (seed) mostra Markdown formatado', await waitText(f, 'Localização') && await f.locator('article table >> visible=true').count() === 1);
  await f.click('button:has-text("Marcar como concluída") >> visible=true');
  ok('Marcar como concluída', await waitText(f, 'Aula concluída · desmarcar'));
  const freeId = sql(`select id from profiles where email='${freeEmail}'`);
  ok('BD: progresso concluído', sql(`select status from student_progress where user_id='${freeId}' and lesson_id='50000000-0000-0000-0000-000000000001'`) === 'completed');
  ok('Lição tem link para a seguinte', await f.isVisible('a:has-text("Seguinte") >> visible=true'));
  ok('Aula (telemóvel) sem scroll horizontal', await noOverflow(f));
  await f.screenshot({ path: `${S}/f6-aula-mobile.png`, fullPage: true });
  await f.goto(`${BASE}/aulas/50000000-0000-0000-0000-000000000003`); await sleep(600);
  ok('Aula em rascunho → página não encontrada', (await f.content()).includes('404'));
  await f.goto(`${BASE}/admin/cursos/${courseId}`); await f.waitForURL(`${BASE}/painel`, { timeout: 8000 }).catch(() => {});
  ok('Estudante não acede à edição de cursos', f.url() === `${BASE}/painel`);
  await f.goto(`${BASE}/painel`);
  ok('Dashboard: "Continuar" aponta para a aula', (await f.locator('a:has-text("Continuar") >> visible=true').first().getAttribute('href') ?? '').startsWith('/aulas/'));
  await fc.close();

  // ======================= ESTUDANTE COM ASSINATURA =======================
  const pc = await newContext(b, { viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }); const p = await pc.newPage(); watch(p);
  await login(p, paidEmail);
  await p.goto(`${BASE}/aulas/${lessonA}`);
  ok('Assinante vê o conteúdo da aula paga', await waitText(p, SECRET));
  ok('Vídeo YouTube (nocookie) incorporado', (await p.getAttribute('iframe >> visible=true', 'src') ?? '').startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  ok('Recurso PDF listado', await p.isVisible('text=Tabela de doses >> visible=true'));
  ok('XSS: <script> não é executado nem inserido', (await p.evaluate(() => window.__xss)) === undefined && (await p.locator('article script').count()) === 0);
  const hrefs = await p.$$eval('article a', as => as.map(x => x.getAttribute('href') || ''));
  ok('XSS: nenhum link javascript:', !hrefs.some(h => h.toLowerCase().startsWith('javascript')));
  await p.screenshot({ path: `${S}/f6-aula-assinante-dark.png`, fullPage: true });
  await pc.close();

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 400));
  await b.close();
  finish();
})().catch((e) => finish(e));
