-- =============================================================================
-- MEDSTUDY MOZ — Migração 10: cópia fixa das perguntas em cada tentativa
-- (ADICIONA uma tabela e actualiza funções; tentativas antigas continuam a usar
--  as perguntas actuais, como antes)
--
-- Ao iniciar um teste, as perguntas (incluindo a resposta certa) são copiadas para
-- quiz_attempt_snapshots. A correcção e a revisão usam essa cópia: se o administrador
-- editar uma pergunta mais tarde, o histórico do estudante não muda.
-- A cópia NUNCA é acessível pela API (contém as respostas certas).
-- =============================================================================

-- Tabela própria (e não uma coluna em quiz_attempts): assim quiz_attempts mantém
-- permissões normais e a cópia fica totalmente inacessível pela API (sem políticas).
create table public.quiz_attempt_snapshots (
  attempt_id  uuid primary key references public.quiz_attempts (id) on delete cascade,
  questions   jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.quiz_attempt_snapshots enable row level security;
-- Sem políticas: ninguém lê nem escreve pela API. Só as funções SECURITY DEFINER.
revoke all on public.quiz_attempt_snapshots from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Perguntas efectivas de uma tentativa: a cópia, ou (tentativas antigas) as actuais
-- -----------------------------------------------------------------------------
create or replace function public._attempt_questions(p_attempt_id uuid)
returns table (
  id uuid, statement text, option_a text, option_b text, option_c text, option_d text,
  correct_option text, explanation text, points integer, "position" integer, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.statement, s.option_a, s.option_b, s.option_c, s.option_d,
         s.correct_option, s.explanation, s.points, s.position, s.created_at
  from public.quiz_attempt_snapshots snap
  cross join lateral jsonb_to_recordset(snap.questions) as s(
    id uuid, statement text, option_a text, option_b text, option_c text, option_d text,
    correct_option text, explanation text, points integer, "position" integer, created_at timestamptz
  )
  where snap.attempt_id = p_attempt_id
  union all
  -- tentativas anteriores a esta migração: perguntas actuais (como antes)
  select q.id, q.statement, q.option_a, q.option_b, q.option_c, q.option_d,
         q.correct_option::text, q.explanation, q.points, q.position, q.created_at
  from public.quiz_attempts a
  join public.questions q on q.quiz_id = a.quiz_id
  where a.id = p_attempt_id
    and not exists (select 1 from public.quiz_attempt_snapshots x where x.attempt_id = a.id);
$$;

revoke execute on function public._attempt_questions(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- start_quiz_attempt: igual ao anterior + grava a cópia das perguntas
-- -----------------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_quiz     public.quizzes;
  v_attempt  public.quiz_attempts;
  v_used     integer;
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  select q.* into v_quiz
  from public.quizzes q
  join public.courses c on c.id = q.course_id
  where q.id = p_quiz_id
    and ((q.status = 'published' and c.status = 'published') or public.is_admin());

  if v_quiz.id is null then
    raise exception 'Teste não encontrado' using errcode = 'P0002';
  end if;

  if not public.has_course_access(v_quiz.course_id) then
    raise exception 'Assinatura activa necessária' using errcode = '42501';
  end if;

  if not exists (select 1 from public.questions where quiz_id = v_quiz.id) then
    raise exception 'Este teste ainda não tem perguntas';
  end if;

  select * into v_attempt
  from public.quiz_attempts
  where quiz_id = v_quiz.id and user_id = v_uid and status = 'in_progress'
  for update;

  if v_attempt.id is not null then
    if v_attempt.expires_at is null or v_attempt.expires_at > now() then
      return v_attempt;
    end if;
    perform public._grade_attempt(v_attempt.id, '{}'::jsonb, 'expired');
  end if;

  if v_quiz.max_attempts is not null then
    select count(*) into v_used from public.quiz_attempts where quiz_id = v_quiz.id and user_id = v_uid;
    if v_used >= v_quiz.max_attempts then
      raise exception 'Atingiu o número máximo de tentativas (%)', v_quiz.max_attempts;
    end if;
  end if;

  insert into public.quiz_attempts (quiz_id, user_id, expires_at)
  values (
    v_quiz.id,
    v_uid,
    case when v_quiz.time_limit_minutes is not null
         then now() + make_interval(mins => v_quiz.time_limit_minutes) end
  )
  returning * into v_attempt;

  insert into public.quiz_attempt_snapshots (attempt_id, questions)
  select v_attempt.id, jsonb_agg(jsonb_build_object(
      'id', q.id, 'statement', q.statement,
      'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c, 'option_d', q.option_d,
      'correct_option', q.correct_option, 'explanation', q.explanation,
      'points', q.points, 'position', q.position, 'created_at', q.created_at
    ) order by q.position, q.created_at)
  from public.questions q where q.quiz_id = v_quiz.id;

  return v_attempt;
end;
$$;

-- -----------------------------------------------------------------------------
-- _grade_attempt: corrige com as perguntas da tentativa (cópia)
-- -----------------------------------------------------------------------------
create or replace function public._grade_attempt(
  p_attempt_id uuid,
  p_answers    jsonb,
  p_status     public.quiz_attempt_status
)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt   public.quiz_attempts;
  v_clean     jsonb;
  v_score     integer;
  v_max       integer;
  v_pass_mark integer;
  v_pct       numeric(5, 2);
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;

  select coalesce(jsonb_object_agg(q.id::text, upper(a.value)), '{}'::jsonb)
    into v_clean
  from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) a
  join public._attempt_questions(p_attempt_id) q on q.id::text = a.key
  where upper(a.value) in ('A', 'B', 'C', 'D');

  select
    coalesce(sum(q.points) filter (where v_clean ->> q.id::text = q.correct_option), 0),
    coalesce(sum(q.points), 0)
    into v_score, v_max
  from public._attempt_questions(p_attempt_id) q;

  select passing_score into v_pass_mark from public.quizzes where id = v_attempt.quiz_id;
  v_pct := case when v_max > 0 then round(v_score * 100.0 / v_max, 2) else 0 end;

  update public.quiz_attempts
     set status       = p_status,
         answers      = v_clean,
         score        = v_score,
         max_score    = v_max,
         percentage   = v_pct,
         passed       = (p_status = 'submitted' and v_pct >= v_pass_mark),
         submitted_at = now()
   where id = p_attempt_id
  returning * into v_attempt;

  return v_attempt;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_attempt_questions: perguntas da cópia, SEM resposta certa
-- -----------------------------------------------------------------------------
create or replace function public.get_attempt_questions(p_attempt_id uuid)
returns table (
  id uuid, statement text, option_a text, option_b text, option_c text, option_d text,
  points integer, "position" integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_shuffle boolean;
begin
  select * into v_attempt from public.quiz_attempts a
  where a.id = p_attempt_id and a.user_id = (select auth.uid());

  if v_attempt.id is null then
    raise exception 'Tentativa não encontrada' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'Esta tentativa já foi terminada';
  end if;

  select q.shuffle_questions into v_shuffle from public.quizzes q where q.id = v_attempt.quiz_id;

  return query
    select q.id, q.statement, q.option_a, q.option_b, q.option_c, q.option_d, q.points,
           (row_number() over (
              order by case when v_shuffle then md5(q.id::text || v_attempt.id::text) end,
                       q.position, q.created_at
           ))::integer
    from public._attempt_questions(p_attempt_id) q
    order by 8;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_attempt_review: correcção com as perguntas tal como o estudante as viu
-- -----------------------------------------------------------------------------
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid, statement text, option_a text, option_b text, option_c text, option_d text,
  selected_option text, correct_option text, is_correct boolean, explanation text, points integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
begin
  select * into v_attempt from public.quiz_attempts a
  where a.id = p_attempt_id and (a.user_id = (select auth.uid()) or public.is_admin());

  if v_attempt.id is null then
    raise exception 'Tentativa não encontrada' using errcode = 'P0002';
  end if;
  if v_attempt.status = 'in_progress' then
    raise exception 'A correcção só fica disponível depois de submeter';
  end if;

  return query
    select q.id, q.statement, q.option_a, q.option_b, q.option_c, q.option_d,
           v_attempt.answers ->> q.id::text,
           q.correct_option,
           coalesce(v_attempt.answers ->> q.id::text = q.correct_option, false),
           q.explanation, q.points
    from public._attempt_questions(p_attempt_id) q
    order by q.position, q.created_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_question_stats: acerto segundo a resposta certa da cópia de cada tentativa
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
    with per_attempt as (
      select q.id as qid, (a.answers ->> q.id::text = q.correct_option) as ok
      from public.quiz_attempts a
      cross join lateral public._attempt_questions(a.id) q
      where a.quiz_id = p_quiz_id and a.status = 'submitted'
    )
    select qq.id,
           count(pa.qid)::integer,
           count(pa.qid) filter (where pa.ok)::integer,
           case when count(pa.qid) > 0 then round(100.0 * count(pa.qid) filter (where pa.ok) / count(pa.qid), 1) end
    from public.questions qq
    left join per_attempt pa on pa.qid = qq.id
    where qq.quiz_id = p_quiz_id
    group by qq.id, qq.position
    order by qq.position;
end;
$$;

-- -----------------------------------------------------------------------------
-- submit_quiz_attempt: igual ao anterior (corrige com a cópia, via _grade_attempt)
-- -----------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
begin
  if p_answers is not null and jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Formato de respostas inválido';
  end if;

  select * into v_attempt from public.quiz_attempts
  where id = p_attempt_id and user_id = (select auth.uid())
  for update;

  if v_attempt.id is null then
    raise exception 'Tentativa não encontrada' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'Esta tentativa já foi submetida';
  end if;

  if v_attempt.expires_at is not null and now() > v_attempt.expires_at + interval '60 seconds' then
    v_attempt := public._grade_attempt(v_attempt.id, '{}'::jsonb, 'expired');
  else
    v_attempt := public._grade_attempt(v_attempt.id, p_answers, 'submitted');
  end if;
  return v_attempt;
end;
$$;

-- -----------------------------------------------------------------------------
-- Correcção encontrada pela auditoria automática (08_security_audit):
-- a função interna _maputo_day (migração 8) não deve ser chamável pela API.
-- -----------------------------------------------------------------------------
revoke execute on function public._maputo_day(timestamptz) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Índices em falta nas chaves estrangeiras (encontrados na revisão de desempenho).
-- Sem eles, apagar um utilizador/curso/plano obriga a percorrer tabelas inteiras.
-- -----------------------------------------------------------------------------
create index if not exists app_settings_updated_by_idx on public.app_settings (updated_by);
create index if not exists courses_created_by_idx on public.courses (created_by);
create index if not exists manuals_created_by_idx on public.manuals (created_by);
create index if not exists payments_plan_idx on public.payments (plan_id);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by);
create index if not exists quizzes_created_by_idx on public.quizzes (created_by);
create index if not exists subscription_plans_course_idx on public.subscription_plans (course_id);
create index if not exists subscriptions_activated_by_idx on public.subscriptions (activated_by);
