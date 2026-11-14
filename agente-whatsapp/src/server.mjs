// Servidor web: página pública, painel de administração e API do painel.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

// Carrega o .env (se existir) antes de importar módulos que leem variáveis de ambiente.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { default: express } = await import('express');
const store = await import('./store.mjs');
const wa = await import('./whatsapp.mjs');
const { aiConfigured } = await import('./ai.mjs');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DAYS = 7;
const COOKIE = 'agente_sessao';

if (!ADMIN_PASSWORD) console.warn('[aviso] ADMIN_PASSWORD não definida: o painel fica bloqueado até a definir.');
if (!process.env.SESSION_SECRET) console.warn('[aviso] SESSION_SECRET não definida: as sessões terminam a cada reinício.');
if (!aiConfigured()) console.warn('[aviso] ANTHROPIC_API_KEY não definida: o agente não vai responder.');

// ---------- sessão (cookie assinado com HMAC, sem dependências) ----------
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}
function makeToken() {
  const exp = Date.now() + SESSION_DAYS * 86400 * 1000;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}
function validToken(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(payload));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return false;
  return Number(payload.split('.')[1]) > Date.now();
}
function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// limite simples de tentativas de login por IP
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, until: 0 };
  if (rec.until > now) return true;
  return false;
}
function registerFailure(ip) {
  const rec = attempts.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    rec.until = Date.now() + 15 * 60 * 1000;
    rec.count = 0;
  }
  attempts.set(ip, rec);
}

// ---------- app ----------
const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, whatsapp: wa.getWhatsAppState().status }));

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

function requireAuth(req, res, next) {
  if (validToken(readCookie(req, COOKIE))) return next();
  res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
}

app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Defina ADMIN_PASSWORD no servidor.' });
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
  if (!safeEqual(req.body?.password ?? '', ADMIN_PASSWORD)) {
    registerFailure(ip);
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  attempts.delete(ip);
  const secure = req.secure ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(makeToken())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`,
  );
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/status', requireAuth, (req, res) => {
  res.json({ whatsapp: wa.getWhatsAppState(), aiConfigured: aiConfigured(), stats: store.stats() });
});

app.get('/api/settings', requireAuth, (req, res) => res.json(store.getSettings()));
app.put('/api/settings', requireAuth, (req, res) => res.json(store.updateSettings(req.body || {})));

app.get('/api/conversations', requireAuth, (req, res) => res.json(store.listConversations()));

app.get('/api/conversations/:jid', requireAuth, (req, res) => {
  const c = store.markRead(req.params.jid);
  if (!c) return res.status(404).json({ error: 'Conversa não encontrada.' });
  res.json(c);
});

app.post('/api/conversations/:jid/pause', requireAuth, (req, res) => {
  const c = store.setPaused(req.params.jid, req.body?.paused);
  if (!c) return res.status(404).json({ error: 'Conversa não encontrada.' });
  res.json({ ok: true, paused: c.paused });
});

app.post('/api/conversations/:jid/send', requireAuth, async (req, res) => {
  const jid = req.params.jid;
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Mensagem vazia.' });
  if (!store.getConversation(jid)) return res.status(404).json({ error: 'Conversa não encontrada.' });
  try {
    await wa.sendText(jid, text);
    store.addMessage(jid, 'agent', text);
    // quando um humano responde pelo painel, o agente pausa nesta conversa
    store.setPaused(jid, true);
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: err?.message || 'Falha ao enviar.' });
  }
});

app.delete('/api/conversations/:jid', requireAuth, (req, res) => {
  store.deleteConversation(req.params.jid);
  res.json({ ok: true });
});

app.post('/api/whatsapp/logout', requireAuth, async (req, res) => {
  await wa.logoutWhatsApp();
  res.json({ ok: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno.' });
});

// Pterodactyl (Lunes) define SERVER_PORT; cPanel/outros usam PORT.
const port = Number(process.env.SERVER_PORT || process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => console.log(`[servidor] ouvindo na porta ${port}`));

wa.startWhatsApp();

function shutdown() {
  try {
    store.flush();
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
