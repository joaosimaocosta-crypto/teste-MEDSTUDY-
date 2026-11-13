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

## Segurança

- Nunca fazer commit de `.env.local`.
- A chave `SUPABASE_SECRET_KEY` é usada apenas no servidor (`src/lib/supabase/admin.ts`).
- RLS activo em todas as tabelas; os estudantes nunca lêem as respostas correctas nem o endereço dos PDFs.
