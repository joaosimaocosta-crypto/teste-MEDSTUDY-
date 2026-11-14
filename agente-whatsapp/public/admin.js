'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let currentTab = 'dashboard';
let openJid = null;
let openConvo = null;
let pollTimer = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    showLogin();
    throw new Error(data.error || 'Sessão expirada');
  }
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

// ---------- login ----------
function showLogin() {
  clearInterval(pollTimer);
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  $('#password').focus();
}

function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  refresh();
  clearInterval(pollTimer);
  pollTimer = setInterval(refresh, 3000);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: { password: $('#password').value } });
    $('#password').value = '';
    showApp();
    loadSettings();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

// ---------- tabs ----------
function selectTab(tab) {
  currentTab = tab;
  for (const t of $$('.tab')) t.setAttribute('aria-selected', String(t.dataset.tab === tab));
  for (const v of $$('.view')) v.classList.toggle('hidden', v.id !== `view-${tab}`);
  if (tab === 'settings') loadSettings();
  refresh();
}
for (const t of $$('.tab')) t.addEventListener('click', () => selectTab(t.dataset.tab));
for (const b of $$('[data-goto]')) b.addEventListener('click', () => selectTab(b.dataset.goto));

// ---------- dashboard ----------
const STATUS_LABEL = {
  starting: ['Iniciando…', 'wait'],
  connecting: ['Conectando…', 'wait'],
  qr: ['Aguardando leitura do QR code', 'wait'],
  connected: ['Conectado', 'ok'],
  disconnected: ['Desconectado — tentando reconectar', 'off'],
};

async function refreshStatus() {
  const s = await api('/api/status');
  const [label, cls] = STATUS_LABEL[s.whatsapp.status] || [s.whatsapp.status, 'wait'];
  const pill = $('#wa-pill');
  pill.textContent = label;
  pill.className = `pill ${cls}`;
  $('#wa-qr').classList.toggle('hidden', !s.whatsapp.qrDataUrl);
  if (s.whatsapp.qrDataUrl && $('#wa-qr-img').src !== s.whatsapp.qrDataUrl) $('#wa-qr-img').src = s.whatsapp.qrDataUrl;
  $('#wa-connected').classList.toggle('hidden', s.whatsapp.status !== 'connected');
  if (s.whatsapp.me) $('#wa-me').textContent = `${s.whatsapp.me.name || ''} (${s.whatsapp.me.id.split('@')[0]})`.trim();
  $('#wa-error').textContent = s.whatsapp.lastError || '';
  $('#ai-warning').classList.toggle('hidden', s.aiConfigured);
  $('#st-contacts').textContent = s.stats.contacts;
  $('#st-messages').textContent = s.stats.messages24h;
  $('#st-bot').textContent = s.stats.botReplies24h;
  $('#st-paused').textContent = s.stats.paused;
}

$('#wa-logout').addEventListener('click', async () => {
  if (!confirm('Desconectar este número do agente? Será preciso ler um novo QR code.')) return;
  await api('/api/whatsapp/logout', { method: 'POST' }).catch((e) => alert(e.message));
  refresh();
});

$('#quick-enabled').addEventListener('change', async (e) => {
  await api('/api/settings', { method: 'PUT', body: { botEnabled: e.target.checked } });
});

// ---------- conversations ----------
function renderList(list) {
  const box = $('#convo-list');
  const unread = list.reduce((n, c) => n + (c.unread || 0), 0);
  $('#unread-badge').textContent = unread;
  $('#unread-badge').classList.toggle('hidden', !unread);
  if (!list.length) {
    box.replaceChildren(el('div', { class: 'empty', text: 'Ainda não há conversas. Elas aparecem aqui quando alguém enviar mensagem para o número conectado.' }));
    return;
  }
  box.replaceChildren(
    ...list.map((c) => {
      const title = c.name || c.phone || c.jid.split('@')[0];
      return el(
        'button',
        { class: 'convo-item', 'aria-current': String(c.jid === openJid), onclick: () => openConversation(c.jid) },
        [
          el('div', { class: 'avatar', text: (title.replace(/[^\p{L}\p{N}]/gu, '')[0] || '?').toUpperCase() }),
          el('div', { class: 'info' }, [
            el('div', { class: 'name' }, [
              el('span', { text: title }),
              c.unread ? el('span', { class: 'badge', text: String(c.unread) }) : el('span', { class: 'muted', style: 'font-size:.75em;font-weight:400', text: c.last ? fmtTime(c.last.at) : '' }),
            ]),
            el('div', { class: 'preview', text: (c.paused ? '⏸ ' : '') + (c.last ? c.last.text : '') }),
          ]),
        ],
      );
    }),
  );
}

function renderConversation(c) {
  openConvo = c;
  $('#chat-empty').classList.add('hidden');
  $('#chat-open').classList.remove('hidden');
  $('#chat-layout').classList.add('has-open');
  $('#chat-name').textContent = c.name || c.phone || c.jid.split('@')[0];
  $('#chat-phone').textContent = c.phone || '';
  $('#chat-mode').textContent = c.paused ? 'Atendimento humano' : 'IA respondendo';
  $('#chat-mode').className = `pill ${c.paused ? 'wait' : 'ok'}`;
  $('#chat-toggle').textContent = c.paused ? 'Devolver para a IA' : 'Assumir conversa';
  const body = $('#chat-messages');
  const scroller = body.parentElement;
  const atBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60;
  const prevCount = body.childElementCount;
  const who = { user: '', bot: 'IA', agent: 'Atendente' };
  body.replaceChildren(
    ...c.messages.map((m) =>
      el('div', { class: `bubble ${m.from}` }, [document.createTextNode(m.text), el('span', { class: 'meta', text: [who[m.from], fmtTime(m.at)].filter(Boolean).join(' · ') })]),
    ),
  );
  if (atBottom || prevCount === 0 || c.messages.length > prevCount) scroller.scrollTop = scroller.scrollHeight;
}

async function openConversation(jid) {
  if (openJid !== jid) $('#chat-messages').replaceChildren();
  openJid = jid;
  try {
    renderConversation(await api(`/api/conversations/${encodeURIComponent(jid)}`));
  } catch (e) {
    openJid = null;
  }
  refreshList();
}

function closeConversation() {
  openJid = null;
  openConvo = null;
  $('#chat-open').classList.add('hidden');
  $('#chat-empty').classList.remove('hidden');
  $('#chat-layout').classList.remove('has-open');
}

async function refreshList() {
  renderList(await api('/api/conversations'));
}

$('#chat-back').addEventListener('click', () => {
  closeConversation();
  refreshList();
});

$('#chat-toggle').addEventListener('click', async () => {
  if (!openConvo) return;
  await api(`/api/conversations/${encodeURIComponent(openJid)}/pause`, { method: 'POST', body: { paused: !openConvo.paused } });
  openConversation(openJid);
});

$('#chat-delete').addEventListener('click', async () => {
  if (!openJid || !confirm('Apagar o histórico desta conversa do painel?')) return;
  await api(`/api/conversations/${encodeURIComponent(openJid)}`, { method: 'DELETE' });
  closeConversation();
  refreshList();
});

$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text || !openJid) return;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    await api(`/api/conversations/${encodeURIComponent(openJid)}/send`, { method: 'POST', body: { text } });
    input.value = '';
    openConversation(openJid);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

$('#chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('#chat-form').requestSubmit();
  }
});

// ---------- settings ----------
async function loadSettings() {
  const s = await api('/api/settings');
  const form = $('#settings-form');
  for (const [k, v] of Object.entries(s)) {
    const input = form.elements[k];
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(v);
    else input.value = v;
  }
  $('#quick-enabled').checked = Boolean(s.botEnabled);
}

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = {};
  for (const input of form.elements) {
    if (!input.name) continue;
    body[input.name] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
  }
  const msg = $('#settings-msg');
  try {
    await api('/api/settings', { method: 'PUT', body });
    msg.style.color = 'var(--accent)';
    msg.textContent = 'Configurações salvas.';
    $('#quick-enabled').checked = body.botEnabled;
  } catch (err) {
    msg.style.color = '';
    msg.textContent = err.message;
  }
  setTimeout(() => (msg.textContent = ''), 3000);
});

// ---------- polling ----------
async function refresh() {
  try {
    if (currentTab === 'dashboard') await refreshStatus();
    if (currentTab === 'conversations') {
      await refreshList();
      if (openJid) renderConversation(await api(`/api/conversations/${encodeURIComponent(openJid)}`));
    } else {
      // mantém o contador de não lidas atualizado
      await refreshList();
    }
  } catch {
    /* ignora erros de rede pontuais */
  }
}

// início: verifica se já há sessão
api('/api/status')
  .then(() => {
    showApp();
    loadSettings();
  })
  .catch(() => showLogin());
