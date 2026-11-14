// Geração de respostas com o Claude (API da Anthropic).
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

let client = null;
function getClient() {
  if (!client) client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente
  return client;
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Converte o histórico guardado em mensagens da API. Mensagens consecutivas do
 * mesmo papel são juntadas, e a conversa tem de começar pelo usuário.
 * @returns {Anthropic.Beta.BetaMessageParam[]}
 */
function toApiMessages(history) {
  const out = [];
  for (const m of history) {
    const role = m.from === 'user' ? 'user' : 'assistant';
    const prev = out.at(-1);
    if (prev && prev.role === role) prev.content += `\n${m.text}`;
    else out.push({ role, content: m.text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/**
 * Gera a resposta do agente para uma conversa.
 * @param {{systemPrompt: string, businessName: string}} settings
 * @param {Array<{from: string, text: string}>} history  últimas mensagens, a mais recente no fim
 * @param {{name?: string}} contact
 * @returns {Promise<string|null>} texto a enviar, ou null se não houver resposta
 */
export async function generateReply(settings, history, contact) {
  const messages = toApiMessages(history);
  if (!messages.length || messages.at(-1).role !== 'user') return null;

  // O prompt do sistema fica estável (bom para cache); dados variáveis vão numa
  // mensagem de sistema no fim da conversa.
  const system = [
    {
      type: 'text',
      text:
        `${settings.systemPrompt}\n\n` +
        `Nome da empresa: ${settings.businessName}.\n` +
        'Você está conversando pelo WhatsApp: escreva mensagens curtas e naturais, sem títulos nem tabelas. ' +
        'Pode usar *negrito* com asteriscos simples e emojis com moderação.',
      cache_control: { type: 'ephemeral' },
    },
  ];
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  messages.push({
    role: 'system',
    content: `Data/hora atual: ${now}.${contact?.name ? ` Nome do contato no WhatsApp: ${contact.name}.` : ''}`,
  });

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    // Conversa de atendimento: esforço baixo = respostas mais rápidas e baratas.
    output_config: { effort: 'low' },
    // Se o modelo recusar por política, a API tenta automaticamente outro modelo.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
  });

  if (response.stop_reason === 'refusal') {
    console.warn('[ai] pedido recusado:', response.stop_details?.category ?? 'sem categoria');
    return null;
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return text || null;
}

export { Anthropic };
