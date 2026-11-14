// Armazenamento simples em arquivos JSON (sem banco de dados — funciona em qualquer
// hospedagem compartilhada). As escritas são feitas de forma atómica (arquivo temporário + rename).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(here, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

const MAX_STORED_MESSAGES = 200; // por contato

export const DEFAULT_SETTINGS = {
  botEnabled: true,
  businessName: 'A Minha Empresa',
  systemPrompt:
    'Você é o assistente virtual de atendimento da empresa no WhatsApp.\n' +
    'Responda sempre em português, de forma simpática, clara e curta (mensagens de WhatsApp, sem markdown pesado).\n' +
    'Se não souber a resposta ou o cliente pedir para falar com uma pessoa, diga que vai encaminhar para um atendente humano.\n\n' +
    'Informações da empresa:\n' +
    '- Horário: segunda a sexta, 9h às 18h\n' +
    '- Serviços: (descreva aqui)\n' +
    '- Preços: (descreva aqui)',
  ignoreGroups: true,
  historyLimit: 20,
  replyDelaySeconds: 2,
  handoffKeywords: 'atendente, humano, pessoa',
  handoffMessage: 'Certo! Vou chamar um atendente humano. Aguarde um momento, por favor. 🙏',
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

let settings = { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, {}) };
/** @type {Record<string, {jid: string, name: string, phone: string, paused: boolean, unread: number, updatedAt: number, messages: Array<{from: 'user'|'bot'|'agent', text: string, at: number}>}>} */
let conversations = readJson(CONVERSATIONS_FILE, {});

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeJson(CONVERSATIONS_FILE, conversations);
  }, 500);
}

export function getSettings() {
  return settings;
}

export function updateSettings(patch) {
  const next = { ...settings };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!(key in patch)) continue;
    const def = DEFAULT_SETTINGS[key];
    const val = patch[key];
    if (typeof def === 'boolean') next[key] = Boolean(val);
    else if (typeof def === 'number') {
      const n = Number(val);
      if (Number.isFinite(n)) next[key] = Math.max(0, Math.min(key === 'historyLimit' ? 100 : 60, Math.round(n)));
    } else next[key] = String(val ?? '').slice(0, 20000);
  }
  settings = next;
  writeJson(SETTINGS_FILE, settings);
  return settings;
}

export function getConversation(jid) {
  return conversations[jid];
}

export function ensureConversation(jid, { name, phone } = {}) {
  let c = conversations[jid];
  if (!c) {
    c = conversations[jid] = { jid, name: '', phone: '', paused: false, unread: 0, updatedAt: Date.now(), messages: [] };
  }
  if (name) c.name = name;
  if (phone) c.phone = phone;
  return c;
}

export function addMessage(jid, from, text, meta) {
  const c = ensureConversation(jid, meta);
  c.messages.push({ from, text, at: Date.now() });
  if (c.messages.length > MAX_STORED_MESSAGES) c.messages.splice(0, c.messages.length - MAX_STORED_MESSAGES);
  c.updatedAt = Date.now();
  if (from === 'user') c.unread += 1;
  scheduleSave();
  return c;
}

export function setPaused(jid, paused) {
  const c = conversations[jid];
  if (!c) return null;
  c.paused = Boolean(paused);
  scheduleSave();
  return c;
}

export function markRead(jid) {
  const c = conversations[jid];
  if (c && c.unread) {
    c.unread = 0;
    scheduleSave();
  }
  return c;
}

export function deleteConversation(jid) {
  delete conversations[jid];
  scheduleSave();
}

export function listConversations() {
  return Object.values(conversations)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ messages, ...rest }) => ({ ...rest, last: messages.at(-1) ?? null }));
}

export function stats() {
  const all = Object.values(conversations);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  let messagesToday = 0;
  let botToday = 0;
  for (const c of all) {
    for (const m of c.messages) {
      if (m.at >= dayAgo) {
        messagesToday++;
        if (m.from === 'bot') botToday++;
      }
    }
  }
  return {
    contacts: all.length,
    paused: all.filter((c) => c.paused).length,
    messages24h: messagesToday,
    botReplies24h: botToday,
  };
}

export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeJson(CONVERSATIONS_FILE, conversations);
}
