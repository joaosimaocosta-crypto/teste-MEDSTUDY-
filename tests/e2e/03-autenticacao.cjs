// MEDSTUDY MOZ — testes de ponta a ponta: autenticacao
// Executar com: npm run test:e2e   (ver tests/e2e/run.cjs)
const { sql, chromium, devices, S, BASE, MAIL, ok, sleep, newContext, finish } = require("./lib/helpers.cjs");
async function lastMailLink(to, re) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAIL}/search?query=${encodeURIComponent('to:' + to)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAIL}/message/${list.messages[0].ID}`)).json();
      const m = msg.HTML.match(re); if (m) return { link: m[0].replace(/&amp;/g, '&'), subject: msg.Subject };
    }
    await sleep(500);
  }
  return null;
}

(async () => {
  for (let i=0;i<40;i++){ try{ if((await fetch(BASE)).ok) break;}catch{} await sleep(500); }
  await fetch(`${MAIL}/messages`, { method: 'DELETE' });
  const email = `estudante${Date.now()}@teste.local`;
  const b = await chromium.launch();
  const ctx = await newContext(b, { ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && errors.push(m.text()));

  // 1. Rotas protegidas sem sessão
  await p.goto(`${BASE}/painel`); ok('Sem sessão: /painel → /entrar?next=/painel', p.url() === `${BASE}/entrar?next=%2Fpainel`, p.url());
  await p.goto(`${BASE}/admin`); ok('Sem sessão: /admin → /entrar', p.url().startsWith(`${BASE}/entrar?next=%2Fadmin`), p.url());
  await p.goto(`${BASE}/nova-senha`); ok('Sem sessão: /nova-senha → /entrar', p.url().startsWith(`${BASE}/entrar`));
  await p.screenshot({ path: `${S}/f3-entrar.png` });

  // 2. Registo — validação
  await p.goto(`${BASE}/registar`);
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Indique o seu nome completo.');
  ok('Registo vazio mostra erros de validação', await p.isVisible('text=Tem de aceitar os termos de utilização.'));
  await p.fill('input[name=fullName]', 'Ana Teste Machava');
  await p.fill('input[name=email]', email);
  await p.fill('input[name=password]', 'abc');
  await p.fill('input[name=confirmPassword]', 'xyz');
  await p.click('button[type=submit]');
  const mismatch = await p.waitForSelector('text=As senhas não coincidem.', { timeout: 5000 }).catch(() => null);
  ok('Senha fraca e confirmação diferente são rejeitadas', !!mismatch && await p.isVisible('text=A senha deve ter pelo menos 8 caracteres.'));
  ok('Nome e e-mail são mantidos após erro', (await p.inputValue('input[name=email]')) === email);
  await p.screenshot({ path: `${S}/f3-registar-erros.png`, fullPage: true });

  // 3. Registo válido
  await p.fill('input[name=password]', 'Senha12345');
  await p.fill('input[name=confirmPassword]', 'Senha12345');
  await p.check('input[name=acceptTerms]');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Conta criada!');
  ok('Registo válido pede confirmação por e-mail', true);
  await p.screenshot({ path: `${S}/f3-registo-ok.png` });

  // 4. Login antes de confirmar
  await p.goto(`${BASE}/entrar`);
  await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'Senha12345');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Ainda não confirmou o seu e-mail');
  ok('Login antes de confirmar o e-mail é recusado', true);

  // 5. Confirmar e-mail
  const conf = await lastMailLink(email, /http:\/\/localhost:3000\/auth\/confirm\?[^"]+/);
  ok('E-mail de confirmação recebido (em português)', !!conf && conf.subject.includes('Confirme'), conf?.subject);
  await p.goto(conf.link);
  await p.waitForSelector('text=Olá, Ana');
  ok('Link de confirmação inicia sessão e abre o painel', p.url() === `${BASE}/painel`, p.url());
  ok('Painel mostra convite para os planos (sem assinatura)', await p.isVisible('text=Ver planos'));
  ok('Estudante não vê link de administração', !(await p.isVisible('text=Painel administrativo')));
  await p.screenshot({ path: `${S}/f3-painel.png` });

  // 6. Com sessão
  await p.goto(`${BASE}/entrar`); ok('Com sessão: /entrar → /painel', p.url() === `${BASE}/painel`);
  await p.goto(`${BASE}/admin`); await p.waitForURL(`${BASE}/painel`);
  ok('Estudante em /admin é enviado para /painel', p.url() === `${BASE}/painel`);
  const adminHtml = await (await ctx.request.get(`${BASE}/admin`)).text();
  ok('HTML de /admin não contém dados administrativos para estudante', !adminHtml.includes('Estudantes registados'));

  // 7. Sair
  await p.click('button[aria-label="Sair da conta"]:visible');
  await p.waitForURL(`${BASE}/entrar`);
  await p.goto(`${BASE}/painel`); ok('Após sair, /painel volta a exigir login', p.url().startsWith(`${BASE}/entrar`));

  // 8. Login errado / certo / open redirect
  await p.goto(`${BASE}/entrar`);
  await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'Errada123');
  await p.click('button[type=submit]'); await p.waitForSelector('text=E-mail ou senha incorrectos.');
  ok('Senha errada mostra mensagem genérica', true);
  await p.screenshot({ path: `${S}/f3-login-erro.png` });
  await p.goto(`${BASE}/entrar?next=${encodeURIComponent('//exemplo-malicioso.com')}`);
  await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'Senha12345');
  await p.click('button[type=submit]'); await p.waitForURL(`${BASE}/painel`);
  ok('Redireccionamento externo (?next=//site) é bloqueado', p.url() === `${BASE}/painel`);
  await p.click('button[aria-label="Sair da conta"]:visible'); await p.waitForURL(`${BASE}/entrar`);

  // 9. Recuperar senha
  await p.goto(`${BASE}/recuperar-senha`);
  await p.fill('input[name=email]', 'naoexiste@teste.local'); await p.click('button[type=submit]');
  await p.waitForSelector('text=Se existir uma conta');
  const msgUnknown = await p.textContent('[role=status]');
  await p.goto(`${BASE}/recuperar-senha`);
  await p.fill('input[name=email]', email); await p.click('button[type=submit]');
  await p.waitForSelector('text=Se existir uma conta');
  ok('Resposta igual para e-mail existente e inexistente', msgUnknown === await p.textContent('[role=status]'));
  const rec = await lastMailLink(email, /http:\/\/localhost:3000\/auth\/confirm\?[^"]+type=recovery[^"]*/);
  ok('E-mail de recuperação recebido', !!rec, rec?.subject);
  await p.goto(rec.link); await p.waitForURL(`${BASE}/nova-senha`);
  ok('Link de recuperação abre /nova-senha', true);
  await p.fill('input[name=password]', 'NovaSenha2026'); await p.fill('input[name=confirmPassword]', 'NovaSenha2026');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=A sua senha foi alterada com sucesso.');
  ok('Nova senha guardada e confirmação mostrada', p.url().includes('/painel'));
  await p.click('button[aria-label="Sair da conta"]:visible'); await p.waitForURL(`${BASE}/entrar`);
  await p.goto(rec.link); await p.waitForURL(/erro=link-invalido/);
  ok('Link de recuperação não pode ser reutilizado', !!(await p.waitForSelector('text=O link é inválido ou expirou', { timeout: 5000 }).catch(() => null)));

  await p.screenshot({ path: `${S}/f3-link-invalido.png` });
  // Entrar com a NOVA senha
  await p.fill('input[name=email]', email); await p.fill('input[name=password]', 'NovaSenha2026');
  await p.click('button[type=submit]'); await p.waitForURL(`${BASE}/painel`);
  ok('Login com a nova senha funciona', true);

  // 10. Promover a admin (como no SQL Editor) e testar /admin
  sql(`update public.profiles set role='admin' where email='${email}'`);
  await p.goto(`${BASE}/admin`);
  await p.waitForSelector('text=Estudantes registados');
  ok('Administrador acede a /admin', p.url() === `${BASE}/admin`);
  await p.screenshot({ path: `${S}/f3-admin.png` });
  await p.goto(`${BASE}/painel`); ok('Admin vê link "Painel administrativo"', !!(await p.waitForSelector('text=Painel administrativo', { timeout: 5000 }).catch(() => null)));

  ok('Sem erros de JavaScript no browser', errors.length === 0, errors.join(' | ').slice(0, 300));
  await b.close();
  finish();
})().catch((e) => finish(e));
