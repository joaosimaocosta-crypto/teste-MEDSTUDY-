-- =============================================================================
-- MEDSTUDY MOZ — Testes do catálogo de testes e do fluxo de tentativas (pgTAP)
-- Seed: teste …7001 (publicado, 3 perguntas, 10 min, nota mínima 50%, máx. 3 tentativas)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'quiz1@teste.local', '{}', 'authenticated', 'authenticated');

-- Teste em rascunho e teste sem perguntas (não devem aparecer)
insert into public.quizzes (id, course_id, title, status) values
  ('71000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Rascunho', 'draft'),
  ('71000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Sem perguntas', 'published');
insert into public.questions (quiz_id, statement, option_a, option_b, option_c, option_d, correct_option)
values ('71000000-0000-0000-0000-000000000001', 'Pergunta?', 'a', 'b', 'c', 'd', 'A');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select array_agg(quiz_id) from public.quiz_catalog()
    where quiz_id in ('70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002')),
  array['70000000-0000-0000-0000-000000000001'::uuid],
  'Só lista o teste publicado com perguntas (rascunho e vazio excluídos)'
);
select is(
  (select question_count || '/' || total_points from public.quiz_catalog('70000000-0000-0000-0000-000000000001')),
  '3/3', 'Mostra nº de perguntas e pontos sem expor as perguntas'
);
select is(
  (select is_locked from public.quiz_catalog('70000000-0000-0000-0000-000000000001')),
  true, 'Sem assinatura o teste aparece bloqueado'
);
select is(
  (select attempts_used from public.quiz_catalog('70000000-0000-0000-0000-000000000001')),
  0, 'Começa sem tentativas'
);

-- ---- Com assinatura ------------------------------------------------------------
reset role;
insert into public.subscriptions (user_id, plan_id, status, starts_at, expires_at)
values ('eeeeeeee-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days');
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select is_locked from public.quiz_catalog('70000000-0000-0000-0000-000000000001')),
  false, 'Com assinatura o teste fica desbloqueado'
);

create temp table _a1 as select (public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id;
select is(
  (select in_progress_attempt_id from public.quiz_catalog('70000000-0000-0000-0000-000000000001')),
  (select id from _a1), 'Catálogo indica a tentativa em curso'
);
select is(
  (select (public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id),
  (select id from _a1), 'Iniciar de novo retoma a mesma tentativa'
);
select ok(
  (select expires_at between now() + interval '9 minutes' and now() + interval '11 minutes' from public.quiz_attempts where id = (select id from _a1)),
  'Tentativa tem prazo de 10 minutos'
);

select public.submit_quiz_attempt((select id from _a1),
  '{"80000000-0000-0000-0000-000000000001":"C","80000000-0000-0000-0000-000000000002":"B","80000000-0000-0000-0000-000000000003":"B"}'::jsonb);
select is(
  (select best_percentage::int || '|' || passed_once from public.quiz_catalog('70000000-0000-0000-0000-000000000001')),
  '100|true', 'Melhor resultado 100% e aprovado'
);

-- Segunda e terceira tentativas (a 3.ª fica por responder → atingido o máximo)
select public.submit_quiz_attempt((public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id, '{}'::jsonb);
select public.submit_quiz_attempt((public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id, '{}'::jsonb);
select is(
  (select attempts_used || '|' || best_percentage::int from public.quiz_catalog('70000000-0000-0000-0000-000000000001')),
  '3|100', 'Conta 3 tentativas e mantém a melhor nota'
);
select throws_ok(
  $$ select public.start_quiz_attempt('70000000-0000-0000-0000-000000000001') $$,
  null, 'Atingiu o número máximo de tentativas (3)',
  'Não permite exceder o número máximo de tentativas'
);

-- ---- Tentativa expirada ----------------------------------------------------------
reset role;
update public.quizzes set max_attempts = null where id = '70000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}';
create temp table _a2 as select (public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id;
reset role;
update public.quiz_attempts set expires_at = now() - interval '5 minutes' where id = (select id from _a2);
set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select status::text || '|' || score from public.submit_quiz_attempt((select id from _a2),
    '{"80000000-0000-0000-0000-000000000001":"C"}'::jsonb)),
  'expired|0', 'Submeter depois do prazo (+60 s) → expirada, respostas não contam'
);
select is(
  (select count(*)::int from public.get_attempt_review((select id from _a2))),
  3, 'Tentativa expirada pode ser revista'
);

-- ---- Visitante -----------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select * from public.quiz_catalog() $$, '42501', null, 'Visitante não acede ao catálogo');

select * from finish();
rollback;
