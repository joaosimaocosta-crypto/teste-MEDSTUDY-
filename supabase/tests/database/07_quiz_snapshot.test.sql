-- =============================================================================
-- MEDSTUDY MOZ — Testes da cópia fixa das perguntas (pgTAP)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('12121212-0000-0000-0000-000000000001', 'snap1@teste.local', '{}', 'authenticated', 'authenticated'),
  ('12121212-0000-0000-0000-000000000009', 'snapadmin@teste.local', '{}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '12121212-0000-0000-0000-000000000009';
insert into public.subscriptions (user_id, plan_id, status, starts_at, expires_at)
values ('12121212-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days');
update public.quizzes set max_attempts = null where id = '70000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"12121212-0000-0000-0000-000000000001","role":"authenticated"}';
create temp table _a as select (public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id;

-- Ataque: chamar a função directamente pela API e ler o resultado completo
select is(
  (select (public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).questions_snapshot),
  null, 'start_quiz_attempt (retomar) NÃO devolve a cópia com as respostas'
);

select throws_ok(
  $$ select questions_snapshot from public.quiz_attempts $$,
  '42501', null, 'Estudante NÃO lê a cópia (contém respostas certas)'
);
select lives_ok(
  $$ select id, status, score from public.quiz_attempts $$,
  'Estudante continua a ler as restantes colunas das suas tentativas'
);
select throws_ok(
  $$ select * from public.quiz_attempts $$,
  '42501', null, 'select * também é bloqueado (inclui a coluna protegida)'
);

-- O administrador altera a resposta certa e o enunciado DURANTE a tentativa
reset role;
select ok((select questions_snapshot is not null and jsonb_array_length(questions_snapshot) = 3 from public.quiz_attempts where id = (select id from _a)),
  'Tentativa guarda a cópia das 3 perguntas');
update public.questions set correct_option = 'A', statement = 'Enunciado alterado'
  where id = '80000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"12121212-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select statement from public.get_attempt_questions((select id from _a)) where id = '80000000-0000-0000-0000-000000000001'),
  'Quantas câmaras tem o coração humano?', 'O estudante vê a pergunta tal como estava ao iniciar'
);
-- Responde C (correcta na cópia; "errada" na versão alterada)
create temp table _r as select * from public.submit_quiz_attempt((select id from _a), '{"80000000-0000-0000-0000-000000000001":"C"}'::jsonb);
select is((select score from _r), 1, 'Corrigido com a resposta certa da cópia (C), não com a alteração (A)');
select is((select questions_snapshot from _r), null, 'submit_quiz_attempt NÃO devolve a cópia');
select is(
  (select statement || '|' || correct_option from public.get_attempt_review((select id from _a)) where question_id = '80000000-0000-0000-0000-000000000001'),
  'Quantas câmaras tem o coração humano?|C', 'A revisão mostra a versão original'
);

set local request.jwt.claims = '{"sub":"12121212-0000-0000-0000-000000000009","role":"authenticated"}';
select is(
  (select correct from public.admin_question_stats('70000000-0000-0000-0000-000000000001') where question_id = '80000000-0000-0000-0000-000000000001'),
  1, 'Estatísticas usam a resposta certa da cópia de cada tentativa'
);

select * from finish();
rollback;
