-- =============================================================================
-- MEDSTUDY MOZ — Migração 5: funções do dashboard (só ADICIONA; não altera dados)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- student_subject_progress: progresso do utilizador actual por disciplina.
-- Conta TODAS as aulas publicadas (incluindo bloqueadas) sem expor o conteúdo,
-- para que a percentagem seja correcta mesmo sem assinatura activa.
-- -----------------------------------------------------------------------------
create or replace function public.student_subject_progress()
returns table (
  course_id          uuid,
  course_title       text,
  subject_id         uuid,
  subject_title      text,
  total_lessons      integer,
  completed_lessons  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    co.id, co.title, s.id, s.title,
    count(l.id)::integer as total_lessons,
    count(sp.id)::integer as completed_lessons
  from public.subjects s
  join public.courses co on co.id = s.course_id and co.status = 'published'
  join public.modules m on m.subject_id = s.id and m.status = 'published'
  join public.chapters c on c.module_id = m.id and c.status = 'published'
  join public.lessons l on l.chapter_id = c.id and l.status = 'published'
  left join public.student_progress sp
    on sp.lesson_id = l.id
   and sp.user_id = (select auth.uid())
   and sp.status = 'completed'
  where s.status = 'published'
    and (select auth.uid()) is not null
  group by co.id, co.title, co.position, s.id, s.title, s.position
  order by co.position, s.position, s.title;
$$;

revoke execute on function public.student_subject_progress() from public, anon;
grant execute on function public.student_subject_progress() to authenticated;
