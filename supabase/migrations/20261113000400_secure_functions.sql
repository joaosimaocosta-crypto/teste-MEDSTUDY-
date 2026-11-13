-- =============================================================================
-- MEDSTUDY MOZ — Migração 4: funções seguras (executadas no servidor da BD)
--
--   lesson_outline()          lista de aulas de um capítulo (inclui bloqueadas, sem conteúdo)
--   get_manual_pdf_url()      endereço do PDF, só com assinatura activa
--   start_quiz_attempt()      inicia (ou retoma) uma tentativa
--   get_attempt_questions()   perguntas SEM a resposta correcta
--   submit_quiz_attempt()     corrige e pontua NO SERVIDOR
--   get_attempt_review()      correcção com explicações (só após submeter)
--   expire_subscriptions()    marca assinaturas vencidas como 'expired'
-- =============================================================================

-- -----------------------------------------------------------------------------
-- lesson_outline: índice de aulas publicadas de um capítulo
-- -----------------------------------------------------------------------------
create or replace function public.lesson_outline(p_chapter_id uuid)
returns table (
  id               uuid,
  title            text,
  slug             text,
  summary          text,
  duration_minutes integer,
  is_free_preview  boolean,
  "position"       integer,
  is_locked        boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id, l.title, l.slug, l.summary, l.duration_minutes, l.is_free_preview, l.position,
    not (l.is_free_preview or public.has_course_access(l.course_id)) as is_locked
  from public.lessons l
  where l.chapter_id = p_chapter_id
    and (select auth.uid()) is not null
    and public.is_lesson_published(l.id)
  order by l.position, l.title;
$$;

-- -----------------------------------------------------------------------------
-- get_manual_pdf_url: devolve o endereço do PDF apenas a quem tem acesso.
-- Usado pela rota do servidor /api/manuals/[id] (o endereço nunca vai ao browser).
-- -----------------------------------------------------------------------------
create or replace function public.get_manual_pdf_url(p_manual_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_manual public.manuals;
begin
  select * into v_manual from public.manuals where id = p_manual_id;

  if v_manual.id is null then
    raise exception 'Manual não encontrado' using errcode = 'P0002';
  end if;

  if public.is_admin() then
    return v_manual.pdf_url;
  end if;

  if v_manual.status <> 'published'
     or not exists (select 1 from public.courses c
                    where c.id = v_manual.course_id and c.status = 'published') then
    raise exception 'Manual não encontrado' using errcode = 'P0002';
  end if;

  if not public.has_course_access(v_manual.course_id) then
    raise exception 'Assinatura activa necessária' using errcode = '42501';
  end if;

  return v_manual.pdf_url;
end;
$$;

-- -----------------------------------------------------------------------------
-- Função interna: corrige uma tentativa e grava o resultado.
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

  -- Guardar apenas respostas válidas: perguntas deste teste e valores A–D.
  select coalesce(jsonb_object_agg(q.id::text, upper(a.value)), '{}'::jsonb)
    into v_clean
  from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) a
  join public.questions q on q.id::text = a.key and q.quiz_id = v_attempt.quiz_id
  where upper(a.value) in ('A', 'B', 'C', 'D');

  select
    coalesce(sum(q.points) filter (where v_clean ->> q.id::text = q.correct_option), 0),
    coalesce(sum(q.points), 0)
    into v_score, v_max
  from public.questions q
  where q.quiz_id = v_attempt.quiz_id;

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
-- start_quiz_attempt: inicia uma nova tentativa ou retoma a que está em curso.
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

  -- Tentativa em curso?
  select * into v_attempt
  from public.quiz_attempts
  where quiz_id = v_quiz.id and user_id = v_uid and status = 'in_progress'
  for update;

  if v_attempt.id is not null then
    if v_attempt.expires_at is null or v_attempt.expires_at > now() then
      return v_attempt; -- retomar
    end if;
    -- O tempo acabou sem submissão: fecha como expirada (sem pontuação).
    perform public._grade_attempt(v_attempt.id, '{}'::jsonb, 'expired');
  end if;

  if v_quiz.max_attempts is not null then
    select count(*) into v_used
    from public.quiz_attempts
    where quiz_id = v_quiz.id and user_id = v_uid;

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

  return v_attempt;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_attempt_questions: perguntas de uma tentativa em curso (sem respostas).
-- A ordem é estável durante a tentativa (embaralhada se o teste o pedir).
-- -----------------------------------------------------------------------------
create or replace function public.get_attempt_questions(p_attempt_id uuid)
returns table (
  id         uuid,
  statement  text,
  option_a   text,
  option_b   text,
  option_c   text,
  option_d   text,
  points     integer,
  "position" integer
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
  select * into v_attempt
  from public.quiz_attempts a
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
    from public.questions q
    where q.quiz_id = v_attempt.quiz_id
    order by 8;
end;
$$;

-- -----------------------------------------------------------------------------
-- submit_quiz_attempt: submete as respostas e devolve o resultado.
-- Tolerância de 60 s após o limite (atrasos de rede). Depois disso a tentativa
-- é marcada como 'expired' e as respostas não contam.
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

  select * into v_attempt
  from public.quiz_attempts
  where id = p_attempt_id and user_id = (select auth.uid())
  for update;

  if v_attempt.id is null then
    raise exception 'Tentativa não encontrada' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'Esta tentativa já foi submetida';
  end if;

  if v_attempt.expires_at is not null and now() > v_attempt.expires_at + interval '60 seconds' then
    return public._grade_attempt(v_attempt.id, '{}'::jsonb, 'expired');
  end if;

  return public._grade_attempt(v_attempt.id, p_answers, 'submitted');
end;
$$;

-- -----------------------------------------------------------------------------
-- get_attempt_review: correcção detalhada (só depois de terminada).
-- -----------------------------------------------------------------------------
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id     uuid,
  statement       text,
  option_a        text,
  option_b        text,
  option_c        text,
  option_d        text,
  selected_option text,
  correct_option  text,
  is_correct      boolean,
  explanation     text,
  points          integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
begin
  select * into v_attempt
  from public.quiz_attempts a
  where a.id = p_attempt_id
    and (a.user_id = (select auth.uid()) or public.is_admin());

  if v_attempt.id is null then
    raise exception 'Tentativa não encontrada' using errcode = 'P0002';
  end if;
  if v_attempt.status = 'in_progress' then
    raise exception 'A correcção só fica disponível depois de submeter';
  end if;

  return query
    select q.id, q.statement, q.option_a, q.option_b, q.option_c, q.option_d,
           v_attempt.answers ->> q.id::text,
           q.correct_option::text,
           coalesce(v_attempt.answers ->> q.id::text = q.correct_option, false),
           q.explanation, q.points
    from public.questions q
    where q.quiz_id = v_attempt.quiz_id
    order by q.position, q.created_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- expire_subscriptions: marca como 'expired' as assinaturas vencidas.
-- (O acesso já é negado pela data; isto mantém o estado coerente.
--  Será agendado na Fase 10.)
-- -----------------------------------------------------------------------------
create or replace function public.expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  update public.subscriptions
     set status = 'expired'
   where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------
revoke execute on function public._grade_attempt(uuid, jsonb, public.quiz_attempt_status)
  from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.lesson_outline(uuid)',
    'public.get_manual_pdf_url(uuid)',
    'public.start_quiz_attempt(uuid)',
    'public.get_attempt_questions(uuid)',
    'public.submit_quiz_attempt(uuid, jsonb)',
    'public.get_attempt_review(uuid)',
    'public.expire_subscriptions()',
    'public.is_admin()',
    'public.has_course_access(uuid)',
    'public.has_active_subscription()',
    'public.is_lesson_published(uuid)',
    'public.can_access_lesson(uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- is_admin() é usada nas políticas de courses e subscription_plans, que também
-- se aplicam a visitantes anónimos (devolve sempre false sem sessão).
grant execute on function public.is_admin() to anon;
