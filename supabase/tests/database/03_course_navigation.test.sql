-- =============================================================================
-- MEDSTUDY MOZ — Testes da navegação de conteúdos e do progresso (pgTAP)
-- Seed: aula 1 gratuita (…0001), aula 2 paga (…0002), aula 3 em rascunho (…0003)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('dddddddd-0000-0000-0000-000000000001', 'nav1@teste.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

-- ---- Índice da disciplina, sem assinatura -------------------------------------
select is(
  (select count(*)::int from public.subject_outline('20000000-0000-0000-0000-000000000001')),
  2, 'Índice tem as 2 aulas publicadas (rascunho excluído)'
);
select is(
  (select array_agg(is_locked order by lesson_title) from public.subject_outline('20000000-0000-0000-0000-000000000001')),
  array[true, false],
  'Sem assinatura: aula paga bloqueada, aula gratuita aberta'
);
select is(
  (select count(*)::int from public.subject_outline('20000000-0000-0000-0000-000000000002')),
  0, 'Disciplina em rascunho não mostra nada'
);

-- ---- Contexto da aula -----------------------------------------------------------
select is(
  (select next_lesson_id from public.get_lesson_context('50000000-0000-0000-0000-000000000001')),
  '50000000-0000-0000-0000-000000000002'::uuid, 'Aula 1 → seguinte é a aula 2'
);
select is(
  (select prev_lesson_id from public.get_lesson_context('50000000-0000-0000-0000-000000000002')),
  '50000000-0000-0000-0000-000000000001'::uuid, 'Aula 2 → anterior é a aula 1'
);
select is(
  (select is_locked from public.get_lesson_context('50000000-0000-0000-0000-000000000002')),
  true, 'Contexto indica que a aula 2 está bloqueada'
);
select is(
  (select course_slug from public.get_lesson_context('50000000-0000-0000-0000-000000000002')),
  'tecnico-medicina-geral', 'Contexto inclui o caminho (curso)'
);
select is(
  (select count(*)::int from public.get_lesson_context('50000000-0000-0000-0000-000000000003')),
  0, 'Aula em rascunho não tem contexto (não existe para o estudante)'
);

-- ---- Progresso -------------------------------------------------------------------
select throws_ok(
  $$ select public.touch_lesson('50000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'Não regista visita numa aula bloqueada'
);
select throws_ok(
  $$ select public.set_lesson_completed('50000000-0000-0000-0000-000000000002', true) $$,
  '42501', null, 'Não conclui uma aula bloqueada'
);
select lives_ok(
  $$ select public.touch_lesson('50000000-0000-0000-0000-000000000001') $$,
  'Regista visita na aula gratuita'
);
select is(
  (select status::text from public.student_progress where lesson_id = '50000000-0000-0000-0000-000000000001'),
  'in_progress', 'Visita cria progresso "em curso"'
);
select lives_ok(
  $$ select public.set_lesson_completed('50000000-0000-0000-0000-000000000001', true) $$,
  'Marca a aula gratuita como concluída'
);
select public.touch_lesson('50000000-0000-0000-0000-000000000001');
select is(
  (select status::text from public.student_progress where lesson_id = '50000000-0000-0000-0000-000000000001'),
  'completed', 'Voltar a abrir a aula não desfaz a conclusão'
);
select is(
  (select is_completed from public.subject_outline('20000000-0000-0000-0000-000000000001')
    where lesson_id = '50000000-0000-0000-0000-000000000001'),
  true, 'Índice mostra a aula como concluída'
);
select public.set_lesson_completed('50000000-0000-0000-0000-000000000001', false);
select is(
  (select completed_at from public.student_progress where lesson_id = '50000000-0000-0000-0000-000000000001'),
  null, 'Desmarcar remove a data de conclusão'
);

-- ---- Visitante anónimo -----------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.subject_outline('20000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'Visitante não acede ao índice'
);

select * from finish();
rollback;
