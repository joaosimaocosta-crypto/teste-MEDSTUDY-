-- =============================================================================
-- MEDSTUDY MOZ — Migração 6: navegação de conteúdos e progresso das aulas
-- (só ADICIONA funções; não altera tabelas nem dados)
--
--   subject_outline()       índice de uma disciplina (módulos → capítulos → aulas)
--   get_lesson_context()    caminho da aula, bloqueio, aula anterior/seguinte
--   touch_lesson()          regista que o estudante abriu a aula
--   set_lesson_completed()  marca/desmarca a aula como concluída
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ordem global das aulas publicadas de uma disciplina (usada abaixo)
-- -----------------------------------------------------------------------------
create or replace function public._subject_lessons_ordered(p_subject_id uuid)
returns table (
  module_id uuid, module_title text, module_position integer,
  chapter_id uuid, chapter_title text, chapter_position integer,
  lesson_id uuid, lesson_title text, lesson_summary text,
  duration_minutes integer, is_free_preview boolean, lesson_position integer,
  course_id uuid, seq bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.title, m.position,
         c.id, c.title, c.position,
         l.id, l.title, l.summary, l.duration_minutes, l.is_free_preview, l.position,
         l.course_id,
         row_number() over (order by m.position, m.title, c.position, c.title, l.position, l.title)
  from public.subjects s
  join public.courses co on co.id = s.course_id and co.status = 'published'
  join public.modules m on m.subject_id = s.id and m.status = 'published'
  join public.chapters c on c.module_id = m.id and c.status = 'published'
  join public.lessons l on l.chapter_id = c.id and l.status = 'published'
  where s.id = p_subject_id and s.status = 'published';
$$;

-- -----------------------------------------------------------------------------
-- subject_outline: índice completo de uma disciplina para o estudante actual.
-- Inclui aulas bloqueadas (sem conteúdo) e se cada aula já foi concluída.
-- -----------------------------------------------------------------------------
create or replace function public.subject_outline(p_subject_id uuid)
returns table (
  module_id uuid, module_title text,
  chapter_id uuid, chapter_title text,
  lesson_id uuid, lesson_title text, lesson_summary text,
  duration_minutes integer, is_free_preview boolean,
  is_locked boolean, is_completed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.module_id, o.module_title, o.chapter_id, o.chapter_title,
         o.lesson_id, o.lesson_title, o.lesson_summary, o.duration_minutes, o.is_free_preview,
         not (o.is_free_preview or public.has_course_access(o.course_id)),
         exists (
           select 1 from public.student_progress sp
           where sp.lesson_id = o.lesson_id
             and sp.user_id = (select auth.uid())
             and sp.status = 'completed'
         )
  from public._subject_lessons_ordered(p_subject_id) o
  where (select auth.uid()) is not null
  order by o.seq;
$$;

-- -----------------------------------------------------------------------------
-- get_lesson_context: dados de navegação de uma aula publicada (sem o conteúdo).
-- -----------------------------------------------------------------------------
create or replace function public.get_lesson_context(p_lesson_id uuid)
returns table (
  lesson_id uuid, lesson_title text, lesson_summary text, duration_minutes integer,
  chapter_title text, module_title text,
  subject_id uuid, subject_title text, subject_slug text,
  course_id uuid, course_title text, course_slug text,
  is_free_preview boolean, is_locked boolean, is_completed boolean,
  prev_lesson_id uuid, next_lesson_id uuid,
  position_in_subject bigint, total_in_subject bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_subject_id uuid;
begin
  if (select auth.uid()) is null then
    return;
  end if;

  select s.id into v_subject_id
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  join public.modules m on m.id = c.module_id
  join public.subjects s on s.id = m.subject_id
  where l.id = p_lesson_id;

  if v_subject_id is null then
    return;
  end if;

  return query
    with ordered as (
      select o.*,
             lag(o.lesson_id) over (order by o.seq) as prev_id,
             lead(o.lesson_id) over (order by o.seq) as next_id,
             count(*) over () as total
      from public._subject_lessons_ordered(v_subject_id) o
    )
    select o.lesson_id, o.lesson_title, o.lesson_summary, o.duration_minutes,
           o.chapter_title, o.module_title,
           s.id, s.title, s.slug,
           co.id, co.title, co.slug,
           o.is_free_preview,
           not (o.is_free_preview or public.has_course_access(o.course_id)),
           exists (
             select 1 from public.student_progress sp
             where sp.lesson_id = o.lesson_id
               and sp.user_id = (select auth.uid())
               and sp.status = 'completed'
           ),
           o.prev_id, o.next_id, o.seq, o.total
    from ordered o
    join public.subjects s on s.id = v_subject_id
    join public.courses co on co.id = s.course_id
    where o.lesson_id = p_lesson_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- touch_lesson: o estudante abriu a aula → cria/actualiza o progresso.
-- Nunca "desfaz" uma aula concluída. Exige acesso à aula.
-- -----------------------------------------------------------------------------
create or replace function public.touch_lesson(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Sem acesso a esta aula' using errcode = '42501';
  end if;

  insert into public.student_progress (user_id, lesson_id, status, last_viewed_at)
  values (v_uid, p_lesson_id, 'in_progress', now())
  on conflict (user_id, lesson_id) do update set last_viewed_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- set_lesson_completed: marca (true) ou desmarca (false) a aula como concluída.
-- -----------------------------------------------------------------------------
create or replace function public.set_lesson_completed(p_lesson_id uuid, p_completed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Sem acesso a esta aula' using errcode = '42501';
  end if;

  insert into public.student_progress (user_id, lesson_id, status, completed_at, last_viewed_at)
  values (
    v_uid, p_lesson_id,
    case when p_completed then 'completed' else 'in_progress' end::public.progress_status,
    case when p_completed then now() end,
    now()
  )
  on conflict (user_id, lesson_id) do update
    set status = excluded.status,
        completed_at = excluded.completed_at,
        last_viewed_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public._subject_lessons_ordered(uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.subject_outline(uuid)',
    'public.get_lesson_context(uuid)',
    'public.touch_lesson(uuid)',
    'public.set_lesson_completed(uuid, boolean)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
