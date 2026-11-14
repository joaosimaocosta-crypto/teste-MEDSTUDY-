-- =============================================================================
-- MEDSTUDY MOZ — Migração 7: catálogo de testes para o estudante
-- (só ADICIONA uma função; não altera tabelas nem dados)
--
-- O estudante não pode ler a tabela "questions" (contém as respostas certas).
-- Esta função devolve apenas números agregados: nº de perguntas, pontos,
-- tentativas usadas, melhor resultado, tentativa em curso e se está bloqueado.
-- =============================================================================

create or replace function public.quiz_catalog(p_quiz_id uuid default null)
returns table (
  quiz_id                 uuid,
  title                   text,
  description             text,
  course_id               uuid,
  course_title            text,
  subject_id              uuid,
  subject_title           text,
  time_limit_minutes      integer,
  passing_score           integer,
  max_attempts            integer,
  question_count          integer,
  total_points            integer,
  attempts_used           integer,
  best_percentage         numeric,
  passed_once             boolean,
  in_progress_attempt_id  uuid,
  is_locked               boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.id, q.title, q.description,
    co.id, co.title,
    s.id, s.title,
    q.time_limit_minutes, q.passing_score, q.max_attempts,
    (select count(*)::integer from public.questions qq where qq.quiz_id = q.id),
    (select coalesce(sum(qq.points), 0)::integer from public.questions qq where qq.quiz_id = q.id),
    (select count(*)::integer from public.quiz_attempts a
      where a.quiz_id = q.id and a.user_id = (select auth.uid())),
    (select max(a.percentage) from public.quiz_attempts a
      where a.quiz_id = q.id and a.user_id = (select auth.uid()) and a.status <> 'in_progress'),
    coalesce((select bool_or(a.passed) from public.quiz_attempts a
      where a.quiz_id = q.id and a.user_id = (select auth.uid())), false),
    (select a.id from public.quiz_attempts a
      where a.quiz_id = q.id and a.user_id = (select auth.uid()) and a.status = 'in_progress'
      limit 1),
    not public.has_course_access(q.course_id)
  from public.quizzes q
  join public.courses co on co.id = q.course_id and co.status = 'published'
  left join public.subjects s on s.id = q.subject_id
  where q.status = 'published'
    and (select auth.uid()) is not null
    and (p_quiz_id is null or q.id = p_quiz_id)
    -- só testes com perguntas
    and exists (select 1 from public.questions qq where qq.quiz_id = q.id)
  order by co.position, s.position nulls first, q.position, q.title;
$$;

revoke execute on function public.quiz_catalog(uuid) from public, anon;
grant execute on function public.quiz_catalog(uuid) to authenticated;
