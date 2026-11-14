# MEDSTUDY MOZ

Plataforma de aprendizagem online para estudantes do curso de **Técnico de Medicina Geral** em Moçambique.

## Tecnologias

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Supabase (Auth + PostgreSQL com RLS)
- PDFs hospedados na Lunes Host

## Requisitos

- Node.js ≥ 20.9 (recomendado: 22 LTS)
- npm

## Primeiros passos

```bash
npm install
cp .env.example .env.local   # preencher com os valores reais
npm run dev                  # http://localhost:3000
```

## Base de dados (Supabase)

As migrações SQL estão em `supabase/migrations/` e são a fonte de verdade do esquema.

| Ficheiro | Conteúdo |
|---|---|
| `…0100_core_schema.sql` | Tipos, tabelas, relações, índices |
| `…0200_auth_and_access_functions.sql` | Perfil automático no registo, `is_admin()`, `has_course_access()` |
| `…0300_rls_policies.sql` | Políticas RLS e privilégios por coluna |
| `…0400_secure_functions.sql` | Testes (iniciar/submeter/corrigir), URL protegido dos PDFs |
| `…0500_dashboard_functions.sql` | Progresso por disciplina para o dashboard |
| `…0600_course_navigation.sql` | Índice das disciplinas, contexto das aulas, registo de progresso |
| `…0700_quiz_catalog.sql` | Catálogo de testes (nº de perguntas, tentativas, melhor nota) |
| `…0800_progress_tracking.sql` | Actividade diária (triggers), progresso por disciplina, estatísticas por pergunta |
| `…0900_subscriptions_management.sql` | Definições (instruções de pagamento), gestão de assinaturas e pagamentos, expiração diária (pg_cron) |
| `…1000_quiz_snapshot.sql` | Cópia fixa das perguntas em cada tentativa (histórico estável), índices em falta |

### Ambiente local (requer Docker)

```bash
npm run db:start    # arranca o Supabase local e aplica migrações + seed
npm run db:status   # mostra URL e chaves locais (para o .env.local)
npm run db:test     # testes de segurança (pgTAP)
npm run db:reset    # recria a BD local do zero (apaga dados locais!)
npm run db:types    # regenera src/types/database.ts
```

### Projecto online

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projecto>
npx supabase db push          # aplica as migrações (não aplica o seed)
```

### Primeiro administrador

1. Regista-te normalmente na aplicação.
2. No Supabase → SQL Editor, executa:

```sql
update public.profiles set role = 'admin' where email = 'o-teu-email@exemplo.com';
```

A partir daí, os papéis são geridos no painel administrativo.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Compilação de produção |
| `npm run start` | Executar a compilação de produção |
| `npm run lint` | Verificar o código com ESLint |

## Estrutura

```
src/
├── app/            # rotas (App Router)
├── components/     # ui/, layout/, providers/, features/
├── lib/            # supabase/, auth/, services/, validations/, utils.ts
└── types/
supabase/           # migrations/ e seed.sql (Fase 2)
```

## Autenticação

| Rota | Função |
|---|---|
| `/registar` | Criar conta (confirmação por e-mail) |
| `/entrar` | Iniciar sessão |
| `/recuperar-senha` | Pedir link de redefinição |
| `/nova-senha` | Definir nova senha (após o link) |
| `/auth/confirm` | Destino dos links dos e-mails |
| `/painel` | Área do estudante (protegida) |
| `/admin` | Área administrativa (só `admin`) |

Camadas de protecção: `src/proxy.ts` (verificação rápida da sessão) →
`requireUser()` / `requireAdmin()` em `src/lib/auth/session.ts` (servidor) → RLS na base de dados.

### Modelos de e-mail (produção)

No Supabase → **Authentication → Email Templates**, substituir:
- **Confirm signup** pelo conteúdo de `supabase/templates/confirmation.html`
- **Reset password** pelo conteúdo de `supabase/templates/recovery.html`

E em **Authentication → URL Configuration**: definir o *Site URL* com o domínio da aplicação
e adicionar `https://<domínio>/**` aos *Redirect URLs*.

Localmente, os e-mails podem ser vistos no Mailpit: http://127.0.0.1:54324

## Conteúdos

Hierarquia: **Curso → Disciplina → Módulo → Capítulo → Aula → Recursos**.

- Administração em `/admin/cursos`: novos itens são criados como **rascunho**; só
  ficam visíveis para estudantes quando o item **e todos os níveis acima** estão publicados.
- O conteúdo das aulas é escrito em **Markdown** (HTML embutido não é interpretado).
- Vídeos: links do YouTube (incorporados em modo de privacidade reforçada) e Vimeo.
- Só é possível eliminar um item sem conteúdos dentro (preferir **Arquivado**).
- Estudantes: `/cursos` → curso → disciplina (índice com cadeados) → `/aulas/[id]`.

## Manuais PDF

- Os PDFs ficam alojados na **Lunes Host**; a plataforma guarda apenas o endereço.
- Administração em `/admin/manuais` (com pré-visualização antes de publicar).
- Os estudantes nunca recebem o endereço real: o PDF é entregue por
  `/api/manuals/[id]`, que verifica a sessão e a assinatura **na base de dados**
  (`get_manual_pdf_url`) e transmite o ficheiro por partes (cabeçalho `Range`).
- Visualizador PDF.js (versão *legacy*, compatível com Android antigos); o worker é
  copiado para `public/` automaticamente por `scripts/copy-pdf-worker.mjs`.
- Protecção SSRF: só `https`, sem `localhost`/redes privadas, redireccionamentos
  validados; em produção defina `MANUALS_ALLOWED_HOSTS`.

## Testes e avaliações

- Administração em `/admin/testes`: tempo limite, nota mínima, nº máximo de tentativas,
  perguntas baralhadas; perguntas com 4 alternativas, resposta correcta, explicação e pontos.
  Só é possível publicar com perguntas; testes com tentativas só podem ser arquivados.
- Estudante em `/testes`: as perguntas chegam **sem** a resposta correcta; a correcção e a
  pontuação são feitas **na base de dados** (`submit_quiz_attempt`). Cronómetro com submissão
  automática (tolerância de 60 s no servidor) e respostas guardadas no dispositivo até submeter.

## Progresso

- Tabela `student_activity_days`: uma linha por estudante e dia (aulas abertas, concluídas,
  testes submetidos), preenchida **apenas por triggers** na BD — o estudante não a pode alterar.
- Estudante em `/progresso`: % concluída, tempo de estudo (duração das aulas concluídas),
  sequência de dias, mapa de actividade (12 semanas), evolução das notas, progresso por disciplina.
- Administração: actividade e progresso na ficha do estudante, taxa de acerto por pergunta,
  testes com mais dificuldade na visão geral.

## Assinaturas e pagamentos

- Estados: **pendente → activa → expirada**, ou **suspensa**. O acesso depende sempre da data
  (`has_course_access`); a tarefa diária `medstudy-expirar-assinaturas` (pg_cron, 00:05 em Maputo)
  mantém o estado coerente.
- Estudante em `/assinatura`: escolhe um plano (pedido pendente, com referência do pagamento),
  vê as instruções de pagamento, o estado, a validade e o histórico.
- Administração:
  - `/admin/planos` — planos (preço em MZN, duração, benefícios, acesso a todos ou a um curso)
    e **instruções de pagamento** (editáveis; nunca são inventados números de conta);
  - `/admin/assinaturas` — activar, renovar (soma dias ao fim da validade), suspender, levantar suspensão;
  - `/admin/pagamentos` — registo manual (M-Pesa, e-Mola, mKesh, transferência, numerário),
    com activação/renovação na mesma transacção; anular pagamentos.
- Não há gateway de pagamento nesta versão.

## Testes

| Comando | O que verifica |
|---|---|
| `npm run lint` · `npm run typecheck` | Qualidade do código e tipos |
| `npm run db:test` | ~140 testes pgTAP: RLS, funções seguras, regras de negócio e **auditoria automática** (RLS em todas as tabelas, `search_path` fixo, funções internas e permissões de `anon`) |
| `npm run test:e2e` | ~300 verificações de ponta a ponta (Playwright) + acessibilidade (axe-core, WCAG 2.1 AA) em telemóvel e computador, tema claro e escuro |

`npm run test:e2e` exige o Supabase **local** (`npm run db:start`) e `npm run build`. Recusa-se a correr
se o `.env.local` apontar para outro servidor. Capturas de ecrã ficam em `tests/e2e/.artifacts/`.
A integração contínua (`.github/workflows/ci.yml`) corre tudo isto em cada push.

## Segurança

- Nunca fazer commit de `.env.local`. A chave `SUPABASE_SECRET_KEY` só existe no servidor
  (`src/lib/supabase/admin.ts`); o CI verifica que não aparece no código do browser.
- RLS activo em todas as tabelas; estudantes nunca lêem respostas certas (tabela `questions` e a
  cópia em `quiz_attempt_snapshots`, sem acesso pela API) nem o endereço dos PDFs (privilégio por
  coluna em `manuals.pdf_url`); tudo passa por funções seguras que verificam o acesso.
- Cada página de administração usa `<AdminOnly>` e cada acção chama `requireAdmin()`/`requireUser()`.
- Cabeçalhos HTTP (`next.config.ts`): CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `COOP` e HSTS (em https).
- Limite de tentativas na aplicação (login, registo, recuperação de senha) por IP e por e-mail.

### Limites do Supabase Auth (importante para produção)

Os pedidos de autenticação partem do **servidor** da plataforma, por isso o Supabase vê todos os
estudantes com o mesmo IP. Os limites por IP (por omissão: 30 logins/registos e 150 renovações de
sessão por 5 minutos) passam a ser partilhados pela plataforma inteira. Antes de publicar:

1. Em **Authentication → Rate Limits**, aumentar os limites de *sign-ins/sign-ups* e *token refresh*
   para o volume esperado; **ou**
2. Activar o encaminhamento do IP real do estudante (`Sb-Forwarded-For`, requer a chave secreta e a
   opção `security_sb_forwarded_for_enabled` na Management API) — ver
   https://supabase.com/docs/guides/auth/rate-limits (preparado na Fase 12).
