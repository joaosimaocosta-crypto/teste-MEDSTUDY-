// Ligação ao WhatsApp via QR code (Baileys) e lógica de resposta automática.
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidGroup,
  isJidStatusBroadcast,
  jidNormalizedUser,
  useMultiFileAuthState,
} from 'baileys';
import { DATA_DIR, addMessage, getConversation, getSettings, setPaused } from './store.mjs';
import { aiConfigured, generateReply } from './ai.mjs';

const AUTH_DIR = path.join(DATA_DIR, 'whatsapp-auth');
const logger = pino({ level: process.env.WA_LOG_LEVEL || 'warn' });

const state = {
  status: 'starting', // starting | qr | connecting | connected | disconnected
  qrDataUrl: null,
  me: null,
  lastError: null,
};

let sock = null;
let reconnectTimer = null;
let starting = false;
const sentByBot = new Set(); // ids das mensagens enviadas pela app (para distinguir do humano no celular)
const pending = new Map(); // jid -> timer (agrupa mensagens seguidas numa só resposta)
const busy = new Set(); // jids com resposta em curso

export function getWhatsAppState() {
  return { ...state };
}

function phoneFromJid(jid) {
  const user = (jid || '').split('@')[0].split(':')[0];
  return /^\d+$/.test(user) ? `+${user}` : '';
}

function extractText(message) {
  if (!message) return null;
  const m = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    null
  );
}

function mediaLabel(message) {
  if (!message) return null;
  if (message.audioMessage) return '[áudio]';
  if (message.imageMessage) return '[imagem]';
  if (message.videoMessage) return '[vídeo]';
  if (message.stickerMessage) return '[figurinha]';
  if (message.documentMessage) return '[documento]';
  if (message.locationMessage) return '[localização]';
  if (message.contactMessage) return '[contato]';
  return null;
}

export async function sendText(jid, text) {
  if (!sock || state.status !== 'connected') throw new Error('WhatsApp não está conectado.');
  const sent = await sock.sendMessage(jid, { text });
  if (sent?.key?.id) {
    sentByBot.add(sent.key.id);
    if (sentByBot.size > 1000) sentByBot.delete(sentByBot.values().next().value);
  }
  return sent;
}

async function respond(jid) {
  pending.delete(jid);
  if (busy.has(jid)) {
    // já há uma resposta em curso; tenta de novo quando acabar
    schedule(jid);
    return;
  }
  const settings = getSettings();
  const convo = getConversation(jid);
  if (!convo || convo.paused || !settings.botEnabled || !aiConfigured()) return;
  if (convo.messages.at(-1)?.from !== 'user') return;

  busy.add(jid);
  try {
    await sock?.sendPresenceUpdate('composing', jid).catch(() => {});
    const history = convo.messages.slice(-Math.max(1, settings.historyLimit));
    const reply = await generateReply(settings, history, convo);
    // Pode ter sido pausada enquanto o modelo pensava
    if (!reply || getConversation(jid)?.paused || !getSettings().botEnabled) return;
    await sendText(jid, reply);
    addMessage(jid, 'bot', reply);
  } catch (err) {
    console.error('[whatsapp] erro ao gerar/enviar resposta:', err?.message || err);
    state.lastError = `Erro ao responder: ${err?.message || err}`;
  } finally {
    busy.delete(jid);
    await sock?.sendPresenceUpdate('paused', jid).catch(() => {});
  }
}

function schedule(jid) {
  clearTimeout(pending.get(jid));
  const delay = Math.max(0, getSettings().replyDelaySeconds) * 1000;
  pending.set(jid, setTimeout(() => respond(jid), delay));
}

function matchesHandoff(text, keywords) {
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(text);
  return keywords
    .split(',')
    .map((k) => norm(k.trim()))
    .filter(Boolean)
    .some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t));
}

async function handleIncoming(msg) {
  const jid = msg.key.remoteJid;
  if (!jid || isJidBroadcast(jid) || isJidStatusBroadcast(jid) || jid.endsWith('@newsletter')) return;
  const settings = getSettings();
  if (isJidGroup(jid) && settings.ignoreGroups) return;
  if (!msg.message || msg.message.protocolMessage || msg.message.reactionMessage) return;

  const text = extractText(msg.message) || mediaLabel(msg.message);
  if (!text) return;

  if (msg.key.fromMe) {
    // Enviada pelo próprio número. Se não foi a app, foi um humano no celular:
    // regista e pausa o agente nesta conversa para não "atropelar" o atendente.
    if (sentByBot.has(msg.key.id)) return;
    if (!getConversation(jid)) return;
    addMessage(jid, 'agent', text);
    setPaused(jid, true);
    return;
  }

  const phone = phoneFromJid(msg.key.remoteJidAlt) || phoneFromJid(jid);
  const convo = addMessage(jid, 'user', text, { name: msg.pushName || '', phone });

  if (convo.paused || !settings.botEnabled) return;

  if (settings.handoffKeywords && matchesHandoff(text, settings.handoffKeywords)) {
    setPaused(jid, true);
    if (settings.handoffMessage) {
      try {
        await sendText(jid, settings.handoffMessage);
        addMessage(jid, 'bot', settings.handoffMessage);
      } catch (err) {
        console.error('[whatsapp] erro ao enviar mensagem de transferência:', err?.message || err);
      }
    }
    return;
  }

  if (!extractText(msg.message)) {
    // Só mídia (áudio, figurinha...): o agente lê apenas texto
    const notice = 'Por enquanto só consigo ler mensagens de texto. Pode escrever sua dúvida? 🙂';
    try {
      await sendText(jid, notice);
      addMessage(jid, 'bot', notice);
    } catch {}
    return;
  }

  schedule(jid);
}

export async function startWhatsApp() {
  if (starting) return;
  starting = true;
  clearTimeout(reconnectTimer);
  try {
    state.status = 'connecting';
    const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      /* usa a versão embutida */
    }

    sock = makeWASocket({
      auth: authState,
      logger,
      version,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        state.status = 'qr';
        state.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      }
      if (connection === 'open') {
        state.status = 'connected';
        state.qrDataUrl = null;
        state.lastError = null;
        state.me = { id: jidNormalizedUser(sock.user?.id), name: sock.user?.name || '' };
        console.log('[whatsapp] conectado como', state.me.id);
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        state.me = null;
        state.qrDataUrl = null;
        if (code === DisconnectReason.loggedOut) {
          console.log('[whatsapp] sessão encerrada no celular; gerando novo QR code');
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          state.status = 'disconnected';
          reconnectTimer = setTimeout(startWhatsApp, 1000);
        } else {
          state.status = 'disconnected';
          state.lastError = lastDisconnect?.error?.message || null;
          const delay = code === DisconnectReason.restartRequired ? 500 : 5000;
          reconnectTimer = setTimeout(startWhatsApp, delay);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          await handleIncoming(msg);
        } catch (err) {
          console.error('[whatsapp] erro ao processar mensagem:', err);
        }
      }
    });
  } catch (err) {
    console.error('[whatsapp] falha ao iniciar:', err);
    state.status = 'disconnected';
    state.lastError = err?.message || String(err);
    reconnectTimer = setTimeout(startWhatsApp, 10000);
  } finally {
    starting = false;
  }
}

/** Termina a sessão (desliga o número) e gera um novo QR code. */
export async function logoutWhatsApp() {
  try {
    await sock?.logout();
  } catch {
    // se a ligação já estava fechada, apaga as credenciais manualmente
    sock?.end?.(undefined);
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    setTimeout(startWhatsApp, 1000);
  }
}

