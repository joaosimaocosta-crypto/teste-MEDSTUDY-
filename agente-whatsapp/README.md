# Agente IA para WhatsApp

Site com um agente de inteligência artificial (Claude, da Anthropic) que responde automaticamente às mensagens recebidas no WhatsApp, e um painel de administração.

- **Página pública** (`/`): apresentação do serviço.
- **Painel** (`/admin`), protegido por senha:
  - **Início**: estado da conexão, QR code para conectar o número e estatísticas das últimas 24h.
  - **Conversas**: histórico de cada contato; você pode **assumir** uma conversa (a IA pausa nela), responder pelo painel e devolver a conversa para a IA.
  - **Configurações**: liga/desliga a IA, instruções e informações do negócio (prompt), palavras que chamam um atendente humano, tamanho do histórico, espera antes de responder e opção de ignorar grupos.

A conexão com o WhatsApp é feita **lendo um QR code** (biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys)), como no WhatsApp Web.

> ⚠️ **Atenção:** a conexão via QR code **não é oficial**. O WhatsApp pode banir números que enviam muitas mensagens automáticas ou spam. Use um número dedicado ao atendimento, responda só a quem entrou em contato e evite envios em massa. Para operações maiores, considere a API oficial (Meta Cloud API).

## Como funciona

- Quando chega uma mensagem de texto, o agente espera alguns segundos (para juntar mensagens seguidas), envia as últimas mensagens da conversa ao Claude e responde.
- Se o cliente escrever uma das palavras de transferência (ex.: "atendente"), a IA envia a mensagem de transferência e **pausa** nessa conversa.
- Se você responder **pelo celular** ou **pelo painel**, a IA também pausa nessa conversa, para não atropelar o atendente. Para a IA voltar a responder, clique em **Devolver para a IA** no painel.
- Áudios, figurinhas e outras mídias sem texto recebem um aviso pedindo que o cliente escreva.
- Os dados ficam em arquivos JSON na pasta `data/`, sem banco de dados: as configurações, as conversas e a sessão do WhatsApp.

Modelo usado: `claude-opus-5-5`, com esforço `low` (respostas rápidas e baratas, adequadas para atendimento). Se o modelo recusar uma mensagem por política de segurança, a API tenta automaticamente outro modelo (*server-side fallback*). Para trocar de modelo, defina a variável `CLAUDE_MODEL`.

## Requisitos

- Node.js **20 ou superior**
- Uma chave da API da Anthropic: <https://console.anthropic.com/> (cobrada por uso)
- Um número de WhatsApp (de preferência dedicado ao atendimento)

## Rodar localmente

```bash
cd agente-whatsapp
npm install
cp .env.example .env     # preencha ANTHROPIC_API_KEY, ADMIN_PASSWORD e SESSION_SECRET
npm start
```

Abra <http://localhost:3000/admin>, entre com a senha e leia o QR code no celular (WhatsApp › **Aparelhos conectados** › **Conectar um aparelho**).

## Publicar na Lunes Host (painel Pterodactyl: ctrl.lunes.host)

Este é o caminho recomendado: o servidor fica ligado o tempo todo.

1. **Startup**: em *Docker Image*, escolha Node.js **20 ou superior**. Em *MAIN FILE* (ou *JS file*), coloque `app.js`.
2. **Files**: envie o `.zip` do projeto, clique nos três pontinhos › **Unarchive**. Os arquivos (`app.js`, `package.json`, `src/`, `public/`) devem ficar direto na pasta principal (`/home/container`).
3. Ainda em **Files**, crie um arquivo chamado `.env` com:
   ```
   ANTHROPIC_API_KEY=sua-chave-da-anthropic
   ADMIN_PASSWORD=uma-senha-forte
   SESSION_SECRET=um-texto-aleatorio-longo
   ```
   A porta é definida automaticamente pela Lunes (variável `SERVER_PORT`).
4. **Console** › **Start**. Na primeira vez, o servidor roda `npm install` (pode levar alguns minutos). Quando aparecer `[servidor] ouvindo na porta ...`, está pronto.
5. Abra `http://ENDERECO:PORTA/admin` (o *Address* mostrado no Console, ex.: `http://node53.lunes.host:3106/admin`), entre com a senha e leia o QR code.

> O endereço da Lunes usa **http** (sem cadeado). Use uma senha que você não usa em outros lugares. Para ter HTTPS e um domínio próprio, aponte um domínio com proxy (ex.: Cloudflare) para esse endereço.

## Publicar em hospedagem cPanel (alternativa)

O agente precisa de um **processo Node.js sempre ligado** (a conexão com o WhatsApp é permanente). Na hospedagem cPanel isso é feito pela ferramenta **"Setup Node.js App"**. Antes de contratar, ou se você não encontrar essa ferramenta, **confirme com o suporte da Lunes que o seu plano permite aplicações Node.js 20+ rodando de forma contínua**. Se não permitir, use o plano de hospedagem de aplicações/bots ou uma VPS da Lunes: o código é o mesmo, basta rodar `npm install` e `npm start`.

### 1. Enviar os arquivos

1. No seu computador, compacte a pasta `agente-whatsapp` **sem** `node_modules/`, `data/` e `.env`.
2. No cPanel, abra o **Gerenciador de Arquivos** e envie o `.zip` para a sua pasta pessoal, **fora** de `public_html` (ex.: `/home/SEU_USUARIO/agente-whatsapp`). Extraia o arquivo.

   *Alternativa:* se o seu plano tiver **Git™ Version Control**, clone o repositório e aponte para a pasta `agente-whatsapp`.

### 2. Criar a aplicação Node.js

No cPanel, abra **Setup Node.js App** › **Create Application**:

| Campo | Valor |
|---|---|
| Node.js version | 20 ou superior (a mais recente disponível) |
| Application mode | Production |
| Application root | `agente-whatsapp` |
| Application URL | o seu domínio (ou subdomínio, ex.: `agente.seudominio.com.br`) |
| Application startup file | `app.js` |

Em **Environment variables**, adicione:

| Nome | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | a sua chave da Anthropic |
| `ADMIN_PASSWORD` | uma senha forte para o painel |
| `SESSION_SECRET` | um texto aleatório longo (ex.: 40+ caracteres) |

Clique em **Create**.

### 3. Instalar as dependências

Na mesma tela, clique em **Run NPM Install** e aguarde terminar. Depois clique em **Restart**.

*(Se preferir o terminal/SSH: copie o comando `source …/activate` que aparece no topo da página da aplicação, depois rode `cd ~/agente-whatsapp && npm install`.)*

### 4. Conectar o WhatsApp

Acesse `https://seudominio.com.br/admin`, entre com a senha e leia o QR code. Pronto: o agente começa a responder. Vá em **Configurações** e descreva o seu negócio.

### 5. Manter o agente acordado (importante)

O cPanel (Passenger) pode **suspender a aplicação quando o site fica sem visitas**, o que desconecta o WhatsApp até alguém abrir o site. Para evitar isso, crie uma tarefa agendada em **cPanel › Cron Jobs** a cada 5 minutos:

```
*/5 * * * * curl -fsS https://seudominio.com.br/health > /dev/null 2>&1
```

A sessão do WhatsApp fica salva em `data/whatsapp-auth/`. Ao reiniciar, o agente reconecta sozinho, sem precisar ler o QR code de novo.

## Problemas comuns

| Problema | Solução |
|---|---|
| Painel mostra "chave da API não configurada" | Defina `ANTHROPIC_API_KEY` nas variáveis da aplicação e clique em **Restart**. |
| Fica em "Desconectado — tentando reconectar" | Verifique se o plano permite conexões de saída (WebSocket) para `web.whatsapp.com`. Fale com o suporte da Lunes. |
| O QR code não aparece ou expira | Recarregue o painel: um novo código é gerado automaticamente. |
| Desconectou o número no celular | O agente apaga a sessão antiga e mostra um novo QR code no painel. |
| Erro ao instalar `sharp` | É uma dependência do Baileys com binário pré-compilado. Use Node 20+ e rode **Run NPM Install** de novo; se persistir, peça ao suporte para liberar a instalação de pacotes nativos. |
| Login bloqueado | Depois de 5 senhas erradas, o IP fica bloqueado por 15 minutos. |
| O agente parou depois de um tempo sem visitas | Configure o Cron Job do passo 5. |

## Estrutura

```
agente-whatsapp/
├── app.js              # inicialização (usado pelo cPanel/Passenger)
├── src/
│   ├── server.mjs      # servidor web, login e API do painel
│   ├── whatsapp.mjs    # conexão via QR code e lógica de resposta
│   ├── ai.mjs          # chamada ao Claude
│   └── store.mjs       # armazenamento em JSON (pasta data/)
├── public/             # página pública e painel (HTML/CSS/JS, sem build)
├── .env.example
└── data/               # criada automaticamente (não versionar!)
```

## Segurança

- Nunca envie a pasta `data/` nem o `.env` para o Git: `data/whatsapp-auth/` dá acesso ao seu WhatsApp.
- Use HTTPS no domínio (o cPanel oferece SSL grátis via AutoSSL).
- Troque `ADMIN_PASSWORD` se suspeitar que vazou e clique em **Restart**.
