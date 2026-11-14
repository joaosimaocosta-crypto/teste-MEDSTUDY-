-- =============================================================================
-- MEDSTUDY MOZ — Testes do acompanhamento do progresso (pgTAP)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('ffffffff-0000-0000-0000-000000000001', 'prog1@teste.local', '{}', 'authenticated', 'authenticated'),
  ('ffffffff-0000-0000-0000-000000000002', 'prog2@teste.local', '{}', 'authenticated', 'authenticated'),
  ('ffffffff-0000-0000-0000-000000000009', 'progadmin@teste.local', '{}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'ffffffff-0000-0000-0000-000000000009';
insert into public.subscriptions (user_id, plan_id, status, starts_at, expires_at)
values ('ffffffff-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'active', now() - interval '1 day', now() + interval '30 days');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ffffffff-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---- Actividade registada automaticamente ------------------------------------------
select public.touch_lesson('50000000-0000-0000-0000-000000000001');
select public.touch_lesson('50000000-0000-0000-0000-000000000002');
select public.set_lesson_completed('50000000-0000-0000-0000-000000000001', true);
select is(
  (select lessons_viewed || '|' || lessons_completed from public.student_activity_days where day = (now() at time zone 'Africa/Maputo')::date),
  '2|1', 'Abrir 2 aulas e concluir uma regista a actividade do dia (concluir não conta como visita)'
);
select public.set_lesson_completed('50000000-0000-0000-0000-000000000001', true);
select is(
  (select lessons_completed from public.student_activity_days where day = (now() at time zone 'Africa/Maputo')::date),
  1, 'Marcar de novo como concluída não conta duas vezes'
);
select public.submit_quiz_attempt((public.start_quiz_attempt('70000000-0000-0000-0000-000000000001')).id, '{}'::jsonb);
select is(
  (select quizzes_submitted from public.student_activity_days where day = (now() at time zone 'Africa/Maputo')::date),
  1, 'Submeter um teste conta na actividade do dia'
);

select throws_ok(
  $$ insert into public.student_activity_days (user_id, day, lessons_completed) values ('ffffffff-0000-0000-0000-000000000001', current_date - 1, 99) $$,
  '42501', null, 'Estudante não consegue inventar dias de estudo'
);
select throws_ok(
  $$ update public.student_activity_days set lessons_completed = 99 $$,
  '42501', null, 'Estudante não consegue alterar a sua actividade'
);
select throws_ok(
  $$ select public._log_activity('ffffffff-0000-0000-0000-000000000001', 1, 1, 1) $$,
  '42501', null, 'Função interna de registo não é acessível'
);

-- ---- Progresso por disciplina ---------------------------------------------------------
select is(
  (select completed_lessons || '/' || total_lessons || '|' || completed_minutes from public.my_subject_progress()
    where subject_id = '20000000-0000-0000-0000-000000000001'),
  '1/2|15', 'my_subject_progress inclui os minutos das aulas concluídas'
);
select is(
  (select completed_lessons from public.student_subject_progress() where subject_id = '20000000-0000-0000-0000-000000000001'),
  1, 'student_subject_progress continua igual (compatível com o dashboard)'
);
select throws_ok(
  $$ select * from public.admin_student_subject_progress('ffffffff-0000-0000-0000-000000000002') $$,
  '42501', null, 'Estudante não vê o progresso de outros'
);
select throws_ok(
  $$ select * from public.admin_question_stats('70000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Estudante não vê estatísticas das perguntas'
);

-- ---- Outro estudante ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"ffffffff-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.student_activity_days where user_id = 'ffffffff-0000-0000-0000-000000000001'),
  0, 'Outro estudante não vê a actividade alheia'
);

-- ---- Administrador ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"ffffffff-0000-0000-0000-000000000009","role":"authenticated"}';
select is(
  (select completed_lessons from public.admin_student_subject_progress('ffffffff-0000-0000-0000-000000000001')
    where subject_id = '20000000-0000-0000-0000-000000000001'),
  1, 'Admin vê o progresso do estudante'
);
select is(
  (select count(*)::int from public.admin_question_stats('70000000-0000-0000-0000-000000000001')),
  3, 'Admin vê estatísticas das 3 perguntas'
);
select is(
  (select count(*)::int from public.student_activity_days where user_id = 'ffffffff-0000-0000-0000-000000000001'),
  1, 'Admin vê a actividade dos estudantes'
);

select * from finish();
rollback;
