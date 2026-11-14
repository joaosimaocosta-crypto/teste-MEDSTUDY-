-- =============================================================================
-- MEDSTUDY MOZ — Migração 1: esquema base
-- Tipos (enums), tabelas, chaves estrangeiras, índices e triggers de updated_at.
-- Hierarquia de conteúdos: Curso → Disciplina → Módulo → Capítulo → Aula → Recursos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('student', 'admin');

create type public.publication_status as enum ('draft', 'published', 'archived');

create type public.subscription_status as enum ('pending', 'active', 'expired', 'suspended');

create type public.payment_status as enum ('pending', 'confirmed', 'rejected');

create type public.payment_method as enum ('mpesa', 'emola', 'mkesh', 'bank_transfer', 'cash', 'other');

create type public.resource_type as enum ('pdf', 'video', 'link', 'document', 'image', 'other');

create type public.progress_status as enum ('not_started', 'in_progress', 'completed');

create type public.quiz_attempt_status as enum ('in_progress', 'submitted', 'expired');

-- -----------------------------------------------------------------------------
-- Função genérica para manter updated_at actualizado
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — dados do utilizador (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '' check (char_length(full_name) <= 120),
  email          text,
  phone          text check (phone is null or char_length(phone) <= 30),
  province       text check (province is null or char_length(province) <= 60),
  institution    text check (institution is null or char_length(institution) <= 150),
  academic_year  smallint check (academic_year is null or academic_year between 1 and 6),
  avatar_url     text,
  role           public.user_role not null default 'student',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- courses — cursos (ex.: Técnico de Medicina Geral)
-- -----------------------------------------------------------------------------
create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 2 and 150),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text,
  cover_image_url  text,
  status           public.publication_status not null default 'draft',
  position         integer not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index courses_status_position_idx on public.courses (status, position);

-- -----------------------------------------------------------------------------
-- subjects — disciplinas
-- -----------------------------------------------------------------------------
create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 150),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  status       public.publication_status not null default 'draft',
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (course_id, slug)
);

create index subjects_course_position_idx on public.subjects (course_id, position);

-- -----------------------------------------------------------------------------
-- modules — módulos
-- -----------------------------------------------------------------------------
create table public.modules (
  id           uuid primary key default gen_random_uuid(),
  subject_id   uuid not null references public.subjects (id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 150),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  status       public.publication_status not null default 'draft',
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (subject_id, slug)
);

create index modules_subject_position_idx on public.modules (subject_id, position);

-- -----------------------------------------------------------------------------
-- chapters — capítulos
-- -----------------------------------------------------------------------------
create table public.chapters (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.modules (id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 150),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  status       public.publication_status not null default 'draft',
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (module_id, slug)
);

create index chapters_module_position_idx on public.chapters (module_id, position);

-- -----------------------------------------------------------------------------
-- lessons — aulas
-- course_id é desnormalizado (preenchido automaticamente por trigger) para que
-- as verificações de acesso (RLS) não precisem de percorrer 4 tabelas.
-- -----------------------------------------------------------------------------
create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  chapter_id        uuid not null references public.chapters (id) on delete cascade,
  course_id         uuid not null references public.courses (id) on delete cascade,
  title             text not null check (char_length(title) between 2 and 200),
  slug              text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary           text,
  content           text,              -- conteúdo da aula (Markdown)
  video_url         text,
  duration_minutes  integer check (duration_minutes is null or duration_minutes between 0 and 600),
  is_free_preview   boolean not null default false,
  status            public.publication_status not null default 'draft',
  position          integer not null default 0,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (chapter_id, slug)
);

create index lessons_chapter_position_idx on public.lessons (chapter_id, position);
create index lessons_course_idx on public.lessons (course_id);

-- -----------------------------------------------------------------------------
-- resources — recursos de uma aula (PDF, vídeo, link…)
-- -----------------------------------------------------------------------------
create table public.resources (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  title        text not null check (char_length(title) between 2 and 200),
  type         public.resource_type not null default 'link',
  url          text not null,
  description  text,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index resources_lesson_position_idx on public.resources (lesson_id, position);

-- -----------------------------------------------------------------------------
-- manuals — manuais oficiais em PDF (ficheiros hospedados na Lunes Host)
-- pdf_url NÃO é legível directamente pelos estudantes (ver migração de RLS).
-- -----------------------------------------------------------------------------
create table public.manuals (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses (id) on delete cascade,
  subject_id       uuid references public.subjects (id) on delete set null,
  title            text not null check (char_length(title) between 2 and 200),
  description      text,
  pdf_url          text not null check (pdf_url ~* '^https://'),
  file_size_bytes  bigint check (file_size_bytes is null or file_size_bytes >= 0),
  page_count       integer check (page_count is null or page_count >= 0),
  status           public.publication_status not null default 'draft',
  published_at     timestamptz,
  position         integer not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index manuals_course_status_idx on public.manuals (course_id, status, position);
create index manuals_subject_idx on public.manuals (subject_id);

-- -----------------------------------------------------------------------------
-- quizzes — testes/avaliações
-- Pertence a um curso e, opcionalmente, a uma disciplina/módulo/capítulo/aula.
-- -----------------------------------------------------------------------------
create table public.quizzes (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses (id) on delete cascade,
  subject_id          uuid references public.subjects (id) on delete set null,
  module_id           uuid references public.modules (id) on delete set null,
  chapter_id          uuid references public.chapters (id) on delete set null,
  lesson_id           uuid references public.lessons (id) on delete set null,
  title               text not null check (char_length(title) between 2 and 200),
  description         text,
  time_limit_minutes  integer check (time_limit_minutes is null or time_limit_minutes between 1 and 600),
  passing_score       integer not null default 50 check (passing_score between 0 and 100),
  max_attempts        integer check (max_attempts is null or max_attempts >= 1),
  shuffle_questions   boolean not null default false,
  status              public.publication_status not null default 'draft',
  position            integer not null default 0,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index quizzes_course_status_idx on public.quizzes (course_id, status, position);
create index quizzes_subject_idx on public.quizzes (subject_id);
create index quizzes_module_idx on public.quizzes (module_id);
create index quizzes_chapter_idx on public.quizzes (chapter_id);
create index quizzes_lesson_idx on public.quizzes (lesson_id);

-- -----------------------------------------------------------------------------
-- questions — perguntas de escolha múltipla (4 alternativas)
-- -----------------------------------------------------------------------------
create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes (id) on delete cascade,
  statement       text not null check (char_length(statement) >= 3),
  option_a        text not null,
  option_b        text not null,
  option_c        text not null,
  option_d        text not null,
  correct_option  char(1) not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation     text,
  points          integer not null default 1 check (points between 1 and 100),
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index questions_quiz_position_idx on public.questions (quiz_id, position);

-- -----------------------------------------------------------------------------
-- quiz_attempts — tentativas (só criadas/submetidas através de funções seguras)
-- answers: {"<question_id>": "A" | "B" | "C" | "D", ...}
-- -----------------------------------------------------------------------------
create table public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.quiz_attempt_status not null default 'in_progress',
  started_at    timestamptz not null default now(),
  expires_at    timestamptz,
  submitted_at  timestamptz,
  answers       jsonb not null default '{}'::jsonb,
  score         integer not null default 0,
  max_score     integer not null default 0,
  percentage    numeric(5, 2) not null default 0,
  passed        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);
-- No máximo uma tentativa em curso por estudante e teste.
create unique index quiz_attempts_one_in_progress_idx
  on public.quiz_attempts (quiz_id, user_id) where status = 'in_progress';

-- -----------------------------------------------------------------------------
-- student_progress — progresso por aula
-- -----------------------------------------------------------------------------
create table public.student_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  lesson_id       uuid not null references public.lessons (id) on delete cascade,
  status          public.progress_status not null default 'in_progress',
  last_viewed_at  timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index student_progress_lesson_idx on public.student_progress (lesson_id);

-- -----------------------------------------------------------------------------
-- subscription_plans — planos mensais
-- course_id NULL = plano dá acesso a todos os cursos.
-- -----------------------------------------------------------------------------
create table public.subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 2 and 100),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description    text,
  price_mzn      numeric(10, 2) not null check (price_mzn >= 0),
  duration_days  integer not null default 30 check (duration_days between 1 and 366),
  features       text[] not null default '{}',
  course_id      uuid references public.courses (id) on delete set null,
  is_active      boolean not null default true,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index subscription_plans_active_idx on public.subscription_plans (is_active, position);

-- -----------------------------------------------------------------------------
-- subscriptions — assinaturas dos estudantes
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  plan_id       uuid not null references public.subscription_plans (id) on delete restrict,
  status        public.subscription_status not null default 'pending',
  starts_at     timestamptz,
  expires_at    timestamptz,
  activated_by  uuid references public.profiles (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint subscriptions_dates_chk
    check (expires_at is null or starts_at is null or expires_at > starts_at),
  constraint subscriptions_active_has_dates_chk
    check (status <> 'active' or (starts_at is not null and expires_at is not null))
);

create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index subscriptions_plan_idx on public.subscriptions (plan_id);
create index subscriptions_active_idx on public.subscriptions (user_id, expires_at)
  where status = 'active';
-- No máximo um pedido pendente por estudante.
create unique index subscriptions_one_pending_idx
  on public.subscriptions (user_id) where status = 'pending';

-- -----------------------------------------------------------------------------
-- payments — pagamentos registados manualmente pelo administrador
-- -----------------------------------------------------------------------------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  subscription_id  uuid references public.subscriptions (id) on delete set null,
  plan_id          uuid references public.subscription_plans (id) on delete set null,
  amount_mzn       numeric(10, 2) not null check (amount_mzn >= 0),
  method           public.payment_method not null,
  reference        text check (reference is null or char_length(reference) <= 100),
  status           public.payment_status not null default 'pending',
  paid_at          timestamptz,
  recorded_by      uuid references public.profiles (id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_subscription_idx on public.payments (subscription_id);
create index payments_status_idx on public.payments (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'courses', 'subjects', 'modules', 'chapters', 'lessons',
    'resources', 'manuals', 'quizzes', 'questions', 'student_progress',
    'subscription_plans', 'subscriptions', 'payments'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- lessons.course_id é sempre derivado do capítulo (nunca confiar no cliente)
-- -----------------------------------------------------------------------------
create or replace function public.lessons_set_course_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select s.course_id into new.course_id
  from public.chapters c
  join public.modules m on m.id = c.module_id
  join public.subjects s on s.id = m.subject_id
  where c.id = new.chapter_id;

  if new.course_id is null then
    raise exception 'Capítulo % não encontrado', new.chapter_id;
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger lessons_set_course_id
  before insert or update of chapter_id, status on public.lessons
  for each row execute function public.lessons_set_course_id();

create or replace function public.manuals_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger manuals_set_published_at
  before insert or update of status on public.manuals
  for each row execute function public.manuals_set_published_at();
