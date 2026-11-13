-- =============================================================================
-- MEDSTUDY MOZ — Testes da função student_subject_progress() (pgTAP)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('cccccccc-0000-0000-0000-000000000001', 'progresso1@teste.local', '{}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000002', 'progresso2@teste.local', '{}', 'authenticated', 'authenticated');

-- ---- Aluno 1, sem assinatura -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select total_lessons from public.student_subject_progress()
    where subject_id = '20000000-0000-0000-0000-000000000001'),
  2,
  'Conta as 2 aulas publicadas, incluindo a bloqueada (sem assinatura)'
);
select is(
  (select count(*)::int from public.student_subject_progress()),
  1,
  'Não inclui disciplinas em rascunho'
);
select is(
  (select completed_lessons from public.student_subject_progress()),
  0,
  'Começa com 0 aulas concluídas'
);

insert into public.student_progress (user_id, lesson_id, status, completed_at)
values ('cccccccc-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'completed', now());

select is(
  (select completed_lessons from public.student_subject_progress()),
  1,
  'Conta a aula concluída pelo próprio estudante'
);

-- ---- Aluno 2 -----------------------------------------------------------------
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select completed_lessons from public.student_subject_progress()),
  0,
  'Não conta o progresso de outros estudantes'
);

-- ---- Visitante ---------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.student_subject_progress() $$,
  '42501', null, 'Visitante anónimo não pode executar a função'
);

select * from finish();
rollback;
