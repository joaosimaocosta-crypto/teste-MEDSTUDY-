// Gera supabase/producao/instalar-base-de-dados.sql: todas as migrações num único
// ficheiro, para instalar a base de dados pelo SQL Editor do Supabase (sem terminal).
//   npm run db:install-sql
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "supabase", "migrations");
const outFile = path.join(root, "supabase", "producao", "instalar-base-de-dados.sql");

const header = `-- =============================================================================
-- MEDSTUDY MOZ — Instalação COMPLETA da base de dados (projecto Supabase NOVO)
--
-- Para quem não tem terminal (ex.: telemóvel): copiar TODO este ficheiro para
-- Supabase → SQL Editor → New query → colar → Run.
--
-- Equivale a "npx supabase db push": junta as migrações de supabase/migrations
-- pela ordem e regista-as no histórico, para que futuros "db push" só apliquem
-- as migrações novas. NÃO contém dados de demonstração (seed).
--
-- Segurança: corre numa única transacção (ou aplica tudo, ou nada) e RECUSA-SE
-- a correr se a base de dados já tiver as tabelas da plataforma. Não apaga nada.
--
-- Gerado por scripts/build-install-sql.mjs (npm run db:install-sql) — não editar à mão.
-- =============================================================================
begin;

do $guard$
begin
  if to_regclass('public.profiles') is not null then
    raise exception 'A base de dados já está instalada (public.profiles existe). Nada foi alterado.';
  end if;
end
$guard$;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
`;

const parts = [header];
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const base = f.slice(0, -4);
  const [version, ...rest] = base.split("_");
  parts.push(`\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ${f}\n`);
  parts.push(readFileSync(path.join(dir, f), "utf8").trimEnd() + "\n");
  parts.push(
    `\ninsert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${rest.join("_")}', '{}');\n`,
  );
}
parts.push(`
commit;

-- Verificação: deve mostrar ${files.length} migrações e a tarefa diária activa (1).
select (select count(*) from supabase_migrations.schema_migrations) as migracoes,
       (select count(*) from cron.job where jobname = 'medstudy-expirar-assinaturas' and active) as tarefa_diaria;
`);

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, parts.join(""));
console.log(`Gerado ${path.relative(root, outFile)} (${files.length} migrações)`);
