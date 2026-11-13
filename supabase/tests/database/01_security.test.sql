-- =============================================================================
-- MEDSTUDY MOZ — Testes de segurança da base de dados (pgTAP)
-- Executar com:  npm run db:test
-- Tudo corre dentro de uma transacção e é revertido no fim.
-- Depende dos dados de exemplo de supabase/seed.sql.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(47);

-- -----------------------------------------------------------------------------
-- Preparação: 3 utilizadores de teste
-- (o aluno1 tenta registar-se como "admin" através dos metadados)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aluno1@teste.local', '{"full_name":"Aluno Um","role":"admin"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aluno2@teste.local', '{"full_name":"Aluno Dois"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'admin@teste.local',  '{"full_name":"Administrador"}', 'authenticated', 'authenticated');

-- O primeiro admin é promovido directamente na BD (como será feito no SQL Editor).
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000009';

-- =============================================================================
-- 1. Perfis
-- =============================================================================
select is(
  (select role::text from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'student',
  'Registo cria perfil como student, mesmo que os metadados peçam admin'
);
select is(
  (select full_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Aluno Um',
  'Nome completo é copiado dos metadados do registo'
);

-- ---- Sessão: aluno1 (sem assinatura) ----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'Estudante só vê o próprio perfil');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501', null, 'Estudante NÃO pode alterar o próprio papel'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Aluno Um Actualizado', province = 'Maputo'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'Estudante pode actualizar os seus dados pessoais'
);
update public.profiles set full_name = 'Hacker' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.profiles where full_name = 'Hacker'), 0,
  'Estudante não altera o perfil de outro estudante'
);
select throws_ok(
  $$ select public.set_user_role('aaaaaaaa-0000-0000-0000-000000000001', 'admin') $$,
  '42501', null, 'Estudante não pode usar set_user_role'
);

-- =============================================================================
-- 2. Conteúdos sem assinatura
-- =============================================================================
select is((select count(*)::int from public.courses), 1, 'Vê o curso publicado');
select is((select count(*)::int from public.subjects), 1, 'Não vê disciplinas em rascunho');
select is(
  (select array_agg(slug order by position) from public.lessons),
  array['introducao-ao-coracao'],
  'Sem assinatura só vê o conteúdo da aula gratuita'
);
select is(
  (select count(*)::int from public.lesson_outline('40000000-0000-0000-0000-000000000001')),
  2, 'Índice mostra as 2 aulas publicadas (não mostra rascunhos)'
);
select is(
  (select count(*)::int from public.lesson_outline('40000000-0000-0000-0000-000000000001') where is_locked),
  1, 'Índice marca 1 aula como bloqueada'
);
select is((select count(*)::int from public.resources), 0, 'Sem assinatura não vê recursos de aulas pagas');
select is((select count(*)::int from public.manuals), 1, 'Vê a lista de manuais publicados');
select throws_ok(
  $$ select pdf_url from public.manuals $$,
  '42501', null, 'Não consegue ler pdf_url directamente'
);
select throws_ok(
  $$ select public.get_manual_pdf_url('60000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Sem assinatura não obtém o endereço do PDF'
);
select is((select count(*)::int from public.quizzes), 1, 'Vê o teste publicado');
select is((select count(*)::int from public.questions), 0, 'Nunca lê a tabela de perguntas (respostas correctas)');
select throws_ok(
  $$ select public.start_quiz_attempt('70000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Sem assinatura não inicia testes'
);
select throws_ok(
  $$ insert into public.quiz_attempts (quiz_id, user_id, score, passed)
     values ('70000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 100, true) $$,
  '42501', null, 'Não pode inserir tentativas (nem pontuações) directamente'
);
select throws_ok(
  $$ insert into public.student_progress (user_id, lesson_id, status)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'completed') $$,
  '42501', null, 'Não regista progresso numa aula bloqueada'
);
select lives_ok(
  $$ insert into public.student_progress (user_id, lesson_id, status)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'completed') $$,
  'Regista progresso na aula gratuita'
);

-- =============================================================================
-- 3. Assinaturas e pagamentos
-- =============================================================================
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan_id, status, starts_at, expires_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001',
             'active', now(), now() + interval '30 days') $$,
  '42501', null, 'Estudante NÃO pode criar uma assinatura activa'
);
select lives_ok(
  $$ insert into public.subscriptions (id, user_id, plan_id)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
             '90000000-0000-0000-0000-000000000001') $$,
  'Estudante pode pedir um plano (fica pendente)'
);
update public.subscriptions set status = 'active', starts_at = now(), expires_at = now() + interval '1 year'
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select is(
  (select status::text from public.subscriptions where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'pending', 'Estudante não consegue activar a própria assinatura'
);
select throws_ok(
  $$ insert into public.payments (user_id, amount_mzn, method, status)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 0, 'mpesa', 'confirmed') $$,
  '42501', null, 'Estudante não regista pagamentos'
);

-- ---- Sessão: admin -----------------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000009","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 3, 'Admin vê todos os perfis');
select is((select count(*)::int from public.lessons), 3, 'Admin vê todas as aulas, incluindo rascunhos');
select is((select count(*)::int from public.questions), 3, 'Admin gere as perguntas');
select is(
  public.get_manual_pdf_url('60000000-0000-0000-0000-000000000001'),
  'https://exemplo.invalid/manuais/anatomia.pdf', 'Admin obtém o endereço do PDF'
);
select lives_ok(
  $$ update public.subscriptions
       set status = 'active', starts_at = now(), expires_at = now() + interval '30 days',
           activated_by = 'aaaaaaaa-0000-0000-0000-000000000009'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'Admin activa a assinatura manualmente'
);
select lives_ok(
  $$ insert into public.payments (user_id, subscription_id, plan_id, amount_mzn, method, reference, status, paid_at, recorded_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
             '90000000-0000-0000-0000-000000000001', 0, 'mpesa', 'TESTE123', 'confirmed', now(),
             'aaaaaaaa-0000-0000-0000-000000000009') $$,
  'Admin regista um pagamento manual'
);

-- =============================================================================
-- 4. Com assinatura activa (aluno1)
-- =============================================================================
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.lessons), 2, 'Com assinatura vê as 2 aulas publicadas (não os rascunhos)');
select is((select count(*)::int from public.resources), 1, 'Com assinatura vê os recursos');
select is(
  public.get_manual_pdf_url('60000000-0000-0000-0000-000000000001'),
  'https://exemplo.invalid/manuais/anatomia.pdf', 'Com assinatura obtém o endereço do PDF'
);

-- Teste: iniciar, responder (2 certas em 3) e submeter
create temp table _attempt as
  select (public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id as id;

select is(
  (select count(*)::int from public.get_attempt_questions((select id from _attempt))),
  3, 'Recebe as 3 perguntas do teste'
);
select throws_ok(
  $$ select public.get_attempt_review((select id from _attempt)) $$,
  null, 'A correcção só fica disponível depois de submeter',
  'Não vê a correcção antes de submeter'
);
select is(
  (select row(score, max_score, percentage, passed, status::text)::text
     from public.submit_quiz_attempt(
       (select id from _attempt),
       '{"80000000-0000-0000-0000-000000000001":"C",
         "80000000-0000-0000-0000-000000000002":"A",
         "80000000-0000-0000-0000-000000000003":"b",
         "nao-e-uma-pergunta":"A"}'::jsonb)),
  '(2,3,66.67,t,submitted)',
  'Pontuação automática calculada no servidor (2/3 = 66.67%, aprovado)'
);
select throws_ok(
  $$ select public.submit_quiz_attempt((select id from _attempt), '{}'::jsonb) $$,
  null, 'Esta tentativa já foi submetida', 'Não pode submeter a mesma tentativa duas vezes'
);
select is(
  (select count(*)::int from public.get_attempt_review((select id from _attempt)) where explanation is not null),
  3, 'Após submeter vê a correcção com explicações'
);

-- ---- Sessão: aluno2 (sem assinatura) ----------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';

select is((select count(*)::int from public.quiz_attempts), 0, 'Aluno2 não vê tentativas do aluno1');
select is((select count(*)::int from public.subscriptions), 0, 'Aluno2 não vê assinaturas do aluno1');
select is((select count(*)::int from public.payments), 0, 'Aluno2 não vê pagamentos do aluno1');
select throws_ok(
  $$ select public.get_attempt_review((select id from _attempt)) $$,
  'P0002', null, 'Aluno2 não vê a correcção da tentativa do aluno1'
);

-- =============================================================================
-- 5. Assinatura expirada
-- =============================================================================
reset role;
update public.subscriptions set starts_at = now() - interval '31 days', expires_at = now() - interval '1 day'
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.lessons), 1, 'Assinatura expirada perde o acesso às aulas pagas');

-- =============================================================================
-- 6. Visitante anónimo
-- =============================================================================
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::int from public.courses), 1, 'Visitante vê o catálogo de cursos');
select throws_ok(
  $$ select count(*) from public.lessons $$,
  '42501', null, 'Visitante não acede às aulas'
);

select * from finish();
rollback;
