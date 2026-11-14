# Publicar o MEDSTUDY MOZ

Guia passo a passo para pôr a plataforma online, na ordem recomendada:
**Supabase → Lunes Host → Vercel → domínio → verificação**.

> Os passos indicados com 🔑 são feitos por si nos painéis do Supabase, da Vercel e da Lunes Host.
> Nenhuma credencial deve ser colocada no repositório nem enviada por chat.

---

## 0. Antes de começar

- [ ] Conta no **Supabase** (https://supabase.com), na **Vercel** (https://vercel.com, pode entrar com o GitHub) e acesso à **Lunes Host**.
- [ ] Domínio escolhido (ex.: `medstudy.co.mz`). Neste guia: **`<DOMINIO>`**.
- [ ] Fornecedor de e-mail escolhido (passo 1.6).
- [ ] O código que vai ser publicado está no ramo `main` do GitHub (a Vercel publica a produção a partir do `main`).

---

## 1. Supabase (base de dados e autenticação)

### 1.1 Criar o projecto 🔑

1. Supabase → **New project**.
2. **Region**: a mais próxima de Moçambique entre as disponíveis na lista (menos atraso para os estudantes).
3. Guarde a **senha da base de dados** num gestor de senhas.
4. Plano: para uso comercial recomenda-se um plano pago. No plano gratuito o projecto é
   **pausado após um período sem actividade** e não há cópias de segurança diárias.

### 1.2 Aplicar as migrações (no seu computador)

```bash
npx supabase login
npx supabase link --project-ref <REF-DO-PROJECTO>   # Project Settings → General → Reference ID
npx supabase db push                                # aplica supabase/migrations (NÃO aplica o seed)
```

`db push` só **acrescenta** o que falta; não apaga dados. O `seed.sql` (dados de demonstração)
**não** é enviado para produção.

Confirmar no **SQL Editor**:

```sql
-- Tarefa diária que expira assinaturas (00:05 hora de Maputo)
select jobname, schedule, active from cron.job;   -- deve listar medstudy-expirar-assinaturas | 5 22 * * * | t
```

### 1.3 Chaves da API 🔑

**Project Settings → API Keys**:

| Chave | Onde vai | Pode ir ao browser? |
| --- | --- | --- |
| *Publishable key* (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim (dados protegidos por RLS) |
| *Secret key* (`sb_secret_…`) | `SUPABASE_SECRET_KEY` | **Nunca** |
| *Project URL* (`https://<ref>.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` | Sim |

### 1.4 Autenticação 🔑

**Authentication → URL Configuration**
- *Site URL*: `https://<DOMINIO>`
- *Redirect URLs*: `https://<DOMINIO>/**`

**Authentication → Sign In / Providers → Email**
- *Confirm email*: **ligado**.
- Senha mínima **8** caracteres, com **letras e números** (igual ao ambiente local e à validação da aplicação).

**Authentication → Email Templates** (copiar o conteúdo dos ficheiros):
- *Confirm signup* → `supabase/templates/confirmation.html`
  — assunto: `Confirme o seu registo no MEDSTUDY MOZ`
- *Reset password* → `supabase/templates/recovery.html`
  — assunto: `Redefinir a sua senha do MEDSTUDY MOZ`

### 1.5 Limites de tentativas e IP real do estudante 🔑

Os pedidos de login, registo e recuperação de senha saem do **servidor** da plataforma, por isso,
sem configuração, o Supabase vê **todos os estudantes com o mesmo IP** e os limites (ex.: 30
logins por 5 minutos) passam a ser da plataforma inteira.

**a) Activar o encaminhamento do IP (recomendado)**

1. Crie um *access token* pessoal: Supabase → **Account → Access Tokens** (guarde-o só no seu computador).
2. No terminal (substitua `<REF>`; o token é lido de uma variável, não fica no histórico do código):

   ```bash
   export SUPABASE_ACCESS_TOKEN=...   # o token do passo 1
   curl -X PATCH "https://api.supabase.com/v1/projects/<REF>/config/auth" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"security_sb_forwarded_for_enabled": true}'

   # Confirmar (deve mostrar "security_sb_forwarded_for_enabled":true)
   curl -s "https://api.supabase.com/v1/projects/<REF>/config/auth" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | grep -o '"security_sb_forwarded_for_enabled":[a-z]*'
   ```

3. Na Vercel (passo 3.2) defina `SUPABASE_FORWARD_CLIENT_IP=true`.

A plataforma passa a enviar o IP real no cabeçalho `Sb-Forwarded-For`, **só** no login, registo e
pedido de recuperação de senha, e **só a partir do servidor** com a chave secreta
(`src/lib/supabase/auth.ts`). As consultas de dados continuam a usar a sessão do estudante (RLS).
O IP vem do cabeçalho `x-forwarded-for` definido pela Vercel. Se um dia publicar noutro serviço,
confirme que esse serviço também define este cabeçalho e não aceita o valor enviado pelo browser.

> Verificado: com a opção activa, o Supabase Auth conta os limites por cada IP encaminhado
> (testado localmente com a mesma versão do Supabase Auth).

**b) Ajustar os limites** — **Authentication → Rate Limits**
- *Token refresh*: **aumentar** para o número de estudantes esperado. A renovação de sessão
  também é feita pelo servidor e **não** é coberta pelo encaminhamento acima.
- *Sign-ins / sign-ups*: se não activar (a), aumentar também este valor.
- *Emails sent*: depende do fornecedor de SMTP (passo 1.6).

A aplicação tem ainda o seu próprio limitador (login: 20 por IP / 5 min e 8 por e-mail / 15 min;
registo: 5 por IP / hora; recuperação: 5 por IP / 15 min e 3 por e-mail / hora).

### 1.6 Envio de e-mails (SMTP) 🔑

O servidor de e-mail incorporado do Supabase serve **só para testes** (limite muito baixo).
Em produção, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.

| Opção | Notas |
| --- | --- |
| **Resend** | Simples de configurar; exige verificar o domínio (registos DNS). |
| **Brevo** | Plano gratuito com limite diário; exige verificar o domínio. |
| **SMTP da Lunes Host** | Se o seu plano incluir e-mail no domínio; use os dados SMTP indicados pela Lunes. |

Em qualquer opção:
- Remetente com o seu domínio, ex.: `nao-responder@<DOMINIO>`, nome `MEDSTUDY MOZ`.
- Adicione no DNS os registos **SPF** e **DKIM** (e, de preferência, **DMARC**) indicados pelo
  fornecedor — sem eles, os e-mails vão para o spam.
- Teste: registe uma conta nova e peça recuperação de senha; confirme que os links abrem `https://<DOMINIO>/auth/confirm…`.

### 1.7 Cópias de segurança

- Planos pagos: cópias diárias automáticas (**Database → Backups**).
- Em qualquer plano, cópia manual periódica (no seu computador, com o projecto ligado):

  ```bash
  npx supabase db dump -f backup-esquema.sql
  npx supabase db dump --data-only -f backup-dados.sql
  ```

  Guarde estes ficheiros fora do repositório (contêm dados pessoais dos estudantes).

---

## 2. Lunes Host (manuais PDF) 🔑

1. Coloque os PDFs numa pasta própria, ex.: `https://ficheiros.<DOMINIO>/manuais/`.
2. Use **nomes de ficheiro difíceis de adivinhar** (ex.: `anatomia-7f3k9q2m.pdf`). A plataforma nunca
   mostra o endereço real ao estudante, mas um nome simples poderia ser adivinhado.
3. Desactive a **listagem de pastas**. Em alojamento Apache/cPanel, ficheiro `.htaccess` na pasta:

   ```apache
   Options -Indexes
   ```

4. O domínio dos ficheiros tem de ter **https** válido.
5. Na Vercel, defina `MANUALS_ALLOWED_HOSTS` com esse domínio (ex.: `ficheiros.<DOMINIO>`).
   A plataforma recusa PDFs de qualquer outro domínio.

---

## 3. Vercel (aplicação)

### 3.1 Importar o projecto 🔑

1. Vercel → **Add New → Project** → importe o repositório do GitHub.
2. *Framework*: Next.js (detectado). *Build command* e *Output*: deixe os valores por omissão.
3. **Settings → Functions → Region**: a mesma região do Supabase, ou a mais próxima dela
   (o atraso entre a aplicação e a base de dados é o que mais pesa).

### 3.2 Variáveis de ambiente 🔑

**Settings → Environment Variables** (ambiente *Production*):

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` (marque como *Sensitive*) |
| `NEXT_PUBLIC_SITE_URL` | `https://<DOMINIO>` (sem `/` no fim) |
| `MANUALS_ALLOWED_HOSTS` | `ficheiros.<DOMINIO>` |
| `SUPABASE_FORWARD_CLIENT_IP` | `true` (só depois do passo 1.5 a) |

- `NEXT_PUBLIC_SITE_URL` com `https://` liga automaticamente o **HSTS** e o `upgrade-insecure-requests`.
- As variáveis `NEXT_PUBLIC_*` são gravadas na compilação: depois de as alterar, faça **Redeploy**.
- Nos registos (*Logs*) da Vercel, ao arrancar, a aplicação avisa com `[configuração] …` se
  faltar alguma destas definições.

### 3.3 Domínio 🔑

1. **Settings → Domains → Add** → `<DOMINIO>` (e, se quiser, `www.<DOMINIO>` a redireccionar para ele).
2. No painel do registo do domínio, crie **exactamente** os registos DNS que a Vercel mostrar.
3. Aguarde o certificado https (automático).
4. Volte a confirmar o *Site URL* do Supabase (passo 1.4) com o domínio final.

---

## 4. Primeiro arranque

### 4.1 Primeiro administrador

1. Em `https://<DOMINIO>/registar`, crie a sua conta e confirme o e-mail.
2. Supabase → **SQL Editor**:

   ```sql
   update public.profiles set role = 'admin' where email = 'o-seu-email@exemplo.com';
   ```

3. Recarregue o painel: aparece o botão **Painel administrativo** (ou abra `/admin`). Os restantes papéis gerem-se no painel.

### 4.2 Conteúdos, planos e pagamentos

1. `/admin/cursos` — cursos, disciplinas, módulos, capítulos e aulas.
2. `/admin/manuais` — endereços dos PDFs da Lunes Host (com pré-visualização).
3. `/admin/testes` — testes e perguntas.
4. `/admin/planos` — **planos reais** (preço em MZN, duração) e as **instruções de pagamento**
   (números M-Pesa/e-Mola/conta bancária reais — a plataforma não inventa nenhum).
5. Faça um percurso completo com uma conta de estudante de teste: registo → pedido de plano →
   registo do pagamento em `/admin/pagamentos` → acesso aos conteúdos.

---

## 5. Verificação depois de publicar

### 5.1 Verificação automática (no seu computador)

```bash
npm run test:smoke -- https://<DOMINIO>
```

Só faz pedidos de leitura (não altera nada) e confirma: saúde da aplicação e da base de dados,
cabeçalhos de segurança (incluindo HSTS), redireccionamento das áreas privadas para o login, PDF
recusado sem sessão, página 404 em português, `robots.txt`, `sitemap.xml` e `manifest.webmanifest`
com o domínio correcto. Corra-a depois de cada publicação.

### 5.2 Monitorização 🔑

Crie um monitor gratuito (ex.: UptimeRobot ou Better Stack) para:

- URL: `https://<DOMINIO>/api/health`
- Intervalo: 5 minutos
- Alerta se o código não for **200** ou se a resposta não contiver `"database":"ok"`.

### 5.3 Lista final

- [ ] `npm run test:smoke -- https://<DOMINIO>` → **Tudo OK**
- [ ] Registo, confirmação por e-mail e recuperação de senha funcionam (e-mails não vão para o spam)
- [ ] Administrador criado; planos e instruções de pagamento reais publicados
- [ ] Um PDF abre para um estudante com assinatura activa e é recusado sem assinatura
- [ ] `select * from cron.job` mostra a tarefa diária activa
- [ ] Monitor de `/api/health` activo
- [ ] Encaminhamento de IP activo (`SUPABASE_FORWARD_CLIENT_IP=true`) **ou** limites aumentados
- [ ] Cópia de segurança configurada

---

## 6. Actualizações futuras

1. Desenvolver num ramo → *Pull Request* → o CI (GitHub Actions) corre lint, testes da base de
   dados, compilação e testes E2E.
2. Novas migrações: `npx supabase db push` **antes** de juntar ao `main` (o código novo pode
   depender delas). Nunca editar migrações já aplicadas em produção: criar uma nova.
3. Juntar ao `main` → a Vercel publica automaticamente.
4. `npm run test:smoke -- https://<DOMINIO>`.
5. Se algo correr mal: Vercel → **Deployments** → publicação anterior → **Promote to Production**
   (reverte o código em segundos; a base de dados não é alterada).
