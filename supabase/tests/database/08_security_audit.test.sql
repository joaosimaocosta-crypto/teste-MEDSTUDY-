-- =============================================================================
-- MEDSTUDY MOZ — Auditoria automática de segurança da base de dados (pgTAP)
-- Regras gerais verificadas em TODAS as tabelas e funções do esquema public,
-- para que um esquecimento futuro seja detectado automaticamente.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

-- 1. RLS activo em todas as tabelas
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '{}'::text[], 'Todas as tabelas de public têm RLS activo'
);

-- 2. Funções SECURITY DEFINER com search_path fixo (evita sequestro de funções)
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  '{}'::text[], 'Todas as funções SECURITY DEFINER fixam o search_path'
);

-- 3. Funções internas (_nome) não são chamáveis pela API
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '\_%'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  '{}'::text[], 'Funções internas (_*) não são executáveis por anon/authenticated'
);

-- 4. Visitantes anónimos só executam is_admin (usada nas políticas do catálogo público)
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in ('is_admin')
      -- funções de triggers não são chamáveis pela API (devolvem "trigger")
      and p.prorettype <> 'trigger'::regtype),
  '{}'::text[], 'anon só pode executar is_admin'
);

-- 5. Funções admin_* verificam is_admin (chamada a is_admin ou _assert_admin no corpo)
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%'
      and p.prosrc not like '%is_admin()%' and p.prosrc not like '%_assert_admin()%'),
  '{}'::text[], 'Todas as funções admin_* verificam o papel de administrador'
);

-- 6. anon não tem privilégios de escrita em nenhuma tabela
select is(
  (select coalesce(array_agg(distinct table_name::text), '{}')
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  '{}'::text[], 'Visitantes anónimos não podem escrever em nenhuma tabela'
);

-- 7. Desempenho: todas as chaves estrangeiras têm índice
select is(
  (select coalesce(array_agg(c.conrelid::regclass::text || '.' || a.attname order by 1), '{}')
     from pg_constraint c
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])),
  '{}'::text[], 'Todas as chaves estrangeiras têm índice'
);

select * from finish();
rollback;
