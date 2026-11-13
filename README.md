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
cp .env.example .env.local   # preencher com os valores reais (Fase 2)
npm run dev                  # http://localhost:3000
```

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

## Segurança

- Nunca fazer commit de `.env.local`.
- A chave `SUPABASE_SERVICE_ROLE_KEY` é usada apenas no servidor.
