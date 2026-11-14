-- =============================================================================
-- MEDSTUDY MOZ — Migração 8: acompanhamento do progresso
-- (ADICIONA uma tabela, triggers e funções; preenche o histórico existente.
--  Não altera nem apaga dados existentes.)
--
--   student_activity_days         actividade diária (para sequências de estudo)
--   student_subject_progress()    passa a usar uma função interna (mesmo resultado)
--   admin_student_subject_progress()  progresso de um estudante (só admin)
--   admin_question_stats()        taxa de acerto por pergunta (só admin)
-- =============================================================================

-- Dia civil em Moçambique (UTC+2)
create or replace function public._maputo_day(ts timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (ts at time zone 'Africa/Maputo')::date;
$$;

-- -----------------------------------------------------------------------------
-- Tabela de actividade diária
-- -----------------------------------------------------------------------------
create table public.student_activity_days (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  day                date not null,
  lessons_viewed     integer not null default 0 check (lessons_viewed >= 0),
  lessons_completed  integer not null default 0 check (lessons_completed >= 0),
  quizzes_submitted  integer not null default 0 check (quizzes_submitted >= 0),
  primary key (user_id, day)
);

create index student_activity_days_day_idx on public.student_activity_days (day);

alter table public.student_activity_days enable row level security;

-- Só leitura para o próprio estudante (ou admin). Escrita APENAS pelos triggers.
revoke all on public.student_activity_days from anon;
revoke insert, update, delete, truncate, references, trigger on public.student_activity_days from authenticated;

create policy "activity: ver a própria ou admin"
  on public.student_activity_days for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- Registo automático
-- -----------------------------------------------------------------------------
create or replace function public._log_activity(p_user_id uuid, p_viewed int, p_completed int, p_quizzes int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.student_activity_days (user_id, day, lessons_viewed, lessons_completed, quizzes_submitted)
  values (p_user_id, public._maputo_day(now()), p_viewed, p_completed, p_quizzes)
  on conflict (user_id, day) do update
    set lessons_viewed    = public.student_activity_days.lessons_viewed + excluded.lessons_viewed,
        lessons_completed = public.student_activity_days.lessons_completed + excluded.lessons_completed,
        quizzes_submitted = public.student_activity_days.quizzes_submitted + excluded.quizzes_submitted;
$$;

create or replace function public._on_progress_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewed int := 0;
  v_completed int := 0;
begin
  -- Abertura de aula: novo registo, ou nova visita sem mudança de estado
  -- (concluir/desmarcar também actualiza last_viewed_at, mas não é uma visita).
  if tg_op = 'INSERT'
     or (new.last_viewed_at is distinct from old.last_viewed_at and new.status = old.status) then
    v_viewed := 1;
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    v_completed := 1;
  end if;
  if v_viewed + v_completed > 0 then
    perform public._log_activity(new.user_id, v_viewed, v_completed, 0);
  end if;
  return new;
end;
$$;

create trigger student_progress_activity
  after insert or update on public.student_progress
  for each row execute function public._on_progress_change();

create or replace function public._on_attempt_finished()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'in_progress' and new.status <> 'in_progress' then
    perform public._log_activity(new.user_id, 0, 0, 1);
  end if;
  return new;
end;
$$;

create trigger quiz_attempts_activity
  after update of status on public.quiz_attempts
  for each row execute function public._on_attempt_finished();

-- -----------------------------------------------------------------------------
-- Preencher com o histórico que já existe
-- -----------------------------------------------------------------------------
insert into public.student_activity_days (user_id, day, lessons_viewed, lessons_completed, quizzes_submitted)
select user_id, day, sum(v)::int, sum(c)::int, sum(q)::int
from (
  select user_id, public._maputo_day(last_viewed_at) as day, 1 as v, 0 as c, 0 as q from public.student_progress
  union all
  select user_id, public._maputo_day(completed_at), 0, 1, 0 from public.student_progress where completed_at is not null
  union all
  select user_id, public._maputo_day(submitted_at), 0, 0, 1 from public.quiz_attempts where submitted_at is not null
) h
group by user_id, day
on conflict (user_id, day) do nothing;

-- -----------------------------------------------------------------------------
-- Progresso por disciplina: uma função interna partilhada
-- -----------------------------------------------------------------------------
create or replace function public._subject_progress_for(p_user_id uuid)
returns table (
  course_id uuid, course_title text, subject_id uuid, subject_title text,
  total_lessons integer, completed_lessons integer, completed_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    co.id, co.title, s.id, s.title,
    count(l.id)::integer,
    count(sp.id)::integer,
    coalesce(sum(l.duration_minutes) filter (where sp.id is not null), 0)::integer
  from public.subjects s
  join public.courses co on co.id = s.course_id and co.status = 'published'
  join public.modules m on m.subject_id = s.id and m.status = 'published'
  join public.chapters c on c.module_id = m.id and c.status = 'published'
  join public.lessons l on l.chapter_id = c.id and l.status = 'published'
  left join public.student_progress sp
    on sp.lesson_id = l.id and sp.user_id = p_user_id and sp.status = 'completed'
  where s.status = 'published'
  group by co.id, co.title, co.position, s.id, s.title, s.position
  order by co.position, s.position, s.title;
$$;

-- Mesma assinatura e colunas de antes (o dashboard continua a funcionar).
create or replace function public.student_subject_progress()
returns table (
  course_id uuid, course_title text, subject_id uuid, subject_title text,
  total_lessons integer, completed_lessons integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.course_id, p.course_title, p.subject_id, p.subject_title, p.total_lessons, p.completed_lessons
  from public._subject_progress_for((select auth.uid())) p
  where (select auth.uid()) is not null;
$$;

-- Progresso do próprio estudante com minutos estudados (página /progresso).
create or replace function public.my_subject_progress()
returns table (
  course_id uuid, course_title text, subject_id uuid, subject_title text,
  total_lessons integer, completed_lessons integer, completed_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public._subject_progress_for((select auth.uid())) where (select auth.uid()) is not null;
$$;

-- Progresso de um estudante (só administradores).
create or replace function public.admin_student_subject_progress(p_user_id uuid)
returns table (
  course_id uuid, course_title text, subject_id uuid, subject_title text,
  total_lessons integer, completed_lessons integer, completed_minutes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query select * from public._subject_progress_for(p_user_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Estatísticas por pergunta (só administradores)
-- Considera apenas tentativas submetidas (as expiradas não têm respostas).
-- -----------------------------------------------------------------------------
create or replace function public.admin_question_stats(p_quiz_id uuid)
returns table (question_id uuid, answered integer, correct integer, correct_rate numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return query
    select q.id,
           count(a.id)::integer,
           count(a.id) filter (where a.answers ->> q.id::text = q.correct_option)::integer,
           case when count(a.id) > 0
                then round(100.0 * count(a.id) filter (where a.answers ->> q.id::text = q.correct_option) / count(a.id), 1)
           end
    from public.questions q
    left join public.quiz_attempts a on a.quiz_id = q.quiz_id and a.status = 'submitted'
    where q.quiz_id = p_quiz_id
    group by q.id, q.position
    order by q.position;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public._log_activity(uuid, int, int, int) from public, anon, authenticated;
revoke execute on function public._on_progress_change() from public, anon, authenticated;
revoke execute on function public._on_attempt_finished() from public, anon, authenticated;
revoke execute on function public._subject_progress_for(uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.my_subject_progress()',
    'public.admin_student_subject_progress(uuid)',
    'public.admin_question_stats(uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
