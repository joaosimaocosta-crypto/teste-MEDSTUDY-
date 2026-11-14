-- =============================================================================
-- MEDSTUDY MOZ — Instalação COMPLETA da base de dados (projecto Supabase NOVO)
--
-- Para quem não tem terminal (ex.: telemóvel): copiar TODO este ficheiro para
-- Supabase → SQL Editor → New query → colar → Run.
--
-- Equivale a "npx supabase db push": junta as migrações de supabase/migrations
-- pela ordem e regista-as no histórico, para que futuros "db push" só apliquem
-- as migrações novas. NÃO contém dados de demonstração (seed).
--
-- Segurança: corre numa única transacção (ou aplica tudo, ou nada) e RECUSA-SE
-- a correr se a base de dados já tiver as tabelas da plataforma. Não apaga nada.
--
-- Gerado por scripts/build-install-sql.mjs (npm run db:install-sql) — não editar à mão.
-- =============================================================================
begin;

do $guard$
begin
  if to_regclass('public.profiles') is not null then
    raise exception 'A base de dados já está instalada (public.profiles existe). Nada foi alterado.';
  end if;
end
$guard$;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000100_core_schema.sql
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000100', 'core_schema', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000200_auth_and_access_functions.sql
-- =============================================================================
-- MEDSTUDY MOZ — Migração 2: perfis automáticos e funções de permissão
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Criar o perfil automaticamente quando um utilizador se regista.
-- O papel é SEMPRE 'student' — nunca é lido dos metadados enviados pelo cliente.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Manter o e-mail do perfil sincronizado com auth.users.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- is_admin(): o utilizador actual é administrador?
-- security definer → lê profiles sem passar pelas políticas RLS (evita recursão).
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- has_course_access(course_id): admin, ou assinatura activa e não expirada
-- de um plano global (course_id NULL) ou do próprio curso.
-- -----------------------------------------------------------------------------
create or replace function public.has_course_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.user_id = (select auth.uid())
      and s.status = 'active'
      and s.starts_at <= now()
      and s.expires_at > now()
      and (p.course_id is null or p.course_id = p_course_id)
  );
$$;

-- has_active_subscription(): tem alguma assinatura activa (para o dashboard).
create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status = 'active'
      and s.starts_at <= now()
      and s.expires_at > now()
  );
$$;

-- -----------------------------------------------------------------------------
-- is_lesson_published(lesson_id): a aula e toda a hierarquia acima estão publicadas?
-- -----------------------------------------------------------------------------
create or replace function public.is_lesson_published(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    join public.chapters c on c.id = l.chapter_id
    join public.modules m on m.id = c.module_id
    join public.subjects s on s.id = m.subject_id
    join public.courses co on co.id = s.course_id
    where l.id = p_lesson_id
      and l.status = 'published'
      and c.status = 'published'
      and m.status = 'published'
      and s.status = 'published'
      and co.status = 'published'
  );
$$;

-- -----------------------------------------------------------------------------
-- can_access_lesson(lesson_id): pode ver o conteúdo completo da aula?
-- -----------------------------------------------------------------------------
create or replace function public.can_access_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.lessons l
    where l.id = p_lesson_id
      and public.is_lesson_published(l.id)
      and (l.is_free_preview or public.has_course_access(l.course_id))
  );
$$;

-- -----------------------------------------------------------------------------
-- set_user_role(): apenas administradores podem alterar papéis.
-- -----------------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) and p_role <> 'admin' then
    raise exception 'Não pode remover o seu próprio acesso de administrador';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de execução: ninguém anónimo executa funções internas.
-- -----------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000200', 'auth_and_access_functions', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000300_rls_policies.sql
-- =============================================================================
-- MEDSTUDY MOZ — Migração 3: Row Level Security (RLS) e privilégios
--
-- Regras gerais:
--   * RLS activo em TODAS as tabelas: sem política = sem acesso.
--   * anon (visitante sem sessão) só vê cursos publicados e planos activos.
--   * Estudantes só vêem/alteram os seus próprios dados privados.
--   * Conteúdo protegido exige assinatura activa (has_course_access).
--   * Apenas administradores escrevem conteúdos, planos, assinaturas e pagamentos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Activar RLS
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.courses             enable row level security;
alter table public.subjects            enable row level security;
alter table public.modules             enable row level security;
alter table public.chapters            enable row level security;
alter table public.lessons             enable row level security;
alter table public.resources           enable row level security;
alter table public.manuals             enable row level security;
alter table public.quizzes             enable row level security;
alter table public.questions           enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.student_progress    enable row level security;
alter table public.subscription_plans  enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.payments            enable row level security;

-- -----------------------------------------------------------------------------
-- Privilégios de base (o Supabase concede ALL por omissão; reduzimos ao mínimo)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

grant select on public.courses to anon;
grant select on public.subscription_plans to anon;

-- profiles: o estudante só pode editar campos pessoais (nunca role, email, id).
revoke insert, update on public.profiles from authenticated;
grant update (full_name, phone, province, institution, academic_year, avatar_url)
  on public.profiles to authenticated;

-- manuals: pdf_url nunca é devolvido por SELECT directo.
-- O endereço só é obtido através de get_manual_pdf_url(), que verifica a assinatura.
revoke select on public.manuals from authenticated;
grant select (
  id, course_id, subject_id, title, description, file_size_bytes, page_count,
  status, published_at, position, created_by, created_at, updated_at
) on public.manuals to authenticated;

-- questions: estudantes nunca lêem a tabela (resposta correcta!). Só via funções.
-- quiz_attempts: estudantes só lêem (não há política de escrita para eles);
-- a criação/submissão é feita por funções seguras (migração 4).

-- student_progress: só campos de estado podem ser alterados.
revoke update on public.student_progress from authenticated;
grant update (status, last_viewed_at, completed_at) on public.student_progress to authenticated;

-- =============================================================================
-- profiles
-- =============================================================================
create policy "profiles: ver o próprio perfil ou admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles: actualizar o próprio perfil ou admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- =============================================================================
-- Estrutura de conteúdos: courses, subjects, modules, chapters
-- Títulos e descrições publicados são visíveis (catálogo); escrita só admin.
-- =============================================================================
create policy "courses: ver publicados"
  on public.courses for select to anon, authenticated
  using (status = 'published' or public.is_admin());

create policy "courses: admin gere"
  on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "subjects: ver publicados"
  on public.subjects for select to authenticated
  using (status = 'published' or public.is_admin());

create policy "subjects: admin gere"
  on public.subjects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "modules: ver publicados"
  on public.modules for select to authenticated
  using (status = 'published' or public.is_admin());

create policy "modules: admin gere"
  on public.modules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "chapters: ver publicados"
  on public.chapters for select to authenticated
  using (status = 'published' or public.is_admin());

create policy "chapters: admin gere"
  on public.chapters for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- lessons e resources — conteúdo protegido pela assinatura
-- (a lista de aulas bloqueadas é obtida com lesson_outline(), sem o conteúdo)
-- =============================================================================
create policy "lessons: ver se tem acesso"
  on public.lessons for select to authenticated
  using (
    public.is_admin()
    or (
      public.is_lesson_published(id)
      and (is_free_preview or public.has_course_access(course_id))
    )
  );

create policy "lessons: admin gere"
  on public.lessons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "resources: ver se tem acesso à aula"
  on public.resources for select to authenticated
  using (public.can_access_lesson(lesson_id));

create policy "resources: admin gere"
  on public.resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- manuals — a lista é visível; o PDF exige assinatura (ver get_manual_pdf_url)
-- =============================================================================
create policy "manuals: ver publicados"
  on public.manuals for select to authenticated
  using (
    public.is_admin()
    or (
      status = 'published'
      and exists (
        select 1 from public.courses c
        where c.id = course_id and c.status = 'published'
      )
    )
  );

create policy "manuals: admin gere"
  on public.manuals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- quizzes, questions, quiz_attempts
-- =============================================================================
create policy "quizzes: ver publicados"
  on public.quizzes for select to authenticated
  using (
    public.is_admin()
    or (
      status = 'published'
      and exists (
        select 1 from public.courses c
        where c.id = course_id and c.status = 'published'
      )
    )
  );

create policy "quizzes: admin gere"
  on public.quizzes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "questions: só admin"
  on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "quiz_attempts: ver as próprias ou admin"
  on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "quiz_attempts: admin gere"
  on public.quiz_attempts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- student_progress
-- =============================================================================
create policy "progress: ver o próprio ou admin"
  on public.student_progress for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "progress: registar o próprio em aulas acessíveis"
  on public.student_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_lesson(lesson_id));

create policy "progress: actualizar o próprio"
  on public.student_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_access_lesson(lesson_id));

create policy "progress: admin gere"
  on public.student_progress for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- subscription_plans
-- =============================================================================
create policy "plans: ver activos"
  on public.subscription_plans for select to anon, authenticated
  using (is_active or public.is_admin());

create policy "plans: admin gere"
  on public.subscription_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- subscriptions
-- O estudante pode PEDIR um plano (fica 'pending'); só o admin activa/suspende.
-- =============================================================================
create policy "subscriptions: ver as próprias ou admin"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "subscriptions: estudante pede plano"
  on public.subscriptions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and starts_at is null
    and expires_at is null
    and activated_by is null
    and exists (
      select 1 from public.subscription_plans p
      where p.id = plan_id and p.is_active
    )
  );

create policy "subscriptions: estudante cancela pedido pendente"
  on public.subscriptions for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');

create policy "subscriptions: admin gere"
  on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- payments
-- =============================================================================
create policy "payments: ver os próprios ou admin"
  on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "payments: admin gere"
  on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000300', 'rls_policies', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000400_secure_functions.sql
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000400', 'secure_functions', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000500_dashboard_functions.sql
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000500', 'dashboard_functions', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000600_course_navigation.sql
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000600', 'course_navigation', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000700_quiz_catalog.sql
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000700', 'quiz_catalog', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261113000800_progress_tracking.sql
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261113000800', 'progress_tracking', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261114000900_subscriptions_management.sql
-- =============================================================================
-- MEDSTUDY MOZ — Migração 9: gestão de assinaturas e pagamentos
-- (ADICIONA tabela de definições, funções e tarefa agendada; não altera dados)
--
--   app_settings                      instruções de pagamento e contacto (1 linha)
--   admin_activate_subscription()     activa (datas calculadas pela BD)
--   admin_renew_subscription()        renova a partir do fim da validade actual
--   admin_suspend_subscription()      suspende (o acesso é cortado de imediato)
--   admin_reactivate_subscription()   levanta a suspensão
--   admin_assign_subscription()       cria uma assinatura para um estudante
--   admin_record_payment()            regista pagamento e (opcional) activa/renova
--   pg_cron: expire_subscriptions() todos os dias às 00:05 (hora de Maputo)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Definições da plataforma (uma única linha)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id                    boolean primary key default true check (id),
  payment_instructions  text check (payment_instructions is null or char_length(payment_instructions) <= 5000),
  support_contact       text check (support_contact is null or char_length(support_contact) <= 300),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles (id) on delete set null
);

insert into public.app_settings (id) values (true);

create trigger set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon;
revoke insert, delete, truncate, references, trigger on public.app_settings from authenticated;

create policy "settings: estudantes lêem"
  on public.app_settings for select to authenticated using (true);

create policy "settings: admin altera"
  on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Auxiliar: fim da validade da assinatura activa mais longa do estudante
-- (para uma nova assinatura começar só quando a actual terminar)
-- -----------------------------------------------------------------------------
create or replace function public._current_paid_until(p_user_id uuid, p_exclude uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(expires_at) from public.subscriptions
  where user_id = p_user_id and status = 'active' and expires_at > now() and id <> p_exclude;
$$;

create or replace function public._assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return (select auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- Activar (pedido pendente, expirada ou suspensa → activa com datas novas)
-- -----------------------------------------------------------------------------
create or replace function public.admin_activate_subscription(p_subscription_id uuid, p_starts_at timestamptz default null)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._assert_admin();
  v_sub public.subscriptions;
  v_days int;
  v_start timestamptz;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if v_sub.id is null then raise exception 'Assinatura não encontrada' using errcode = 'P0002'; end if;

  select duration_days into v_days from public.subscription_plans where id = v_sub.plan_id;
  v_start := coalesce(p_starts_at, greatest(now(), coalesce(public._current_paid_until(v_sub.user_id, v_sub.id), now())));

  update public.subscriptions
     set status = 'active',
         starts_at = v_start,
         expires_at = v_start + make_interval(days => v_days),
         activated_by = v_admin
   where id = v_sub.id
  returning * into v_sub;
  return v_sub;
end;
$$;

-- -----------------------------------------------------------------------------
-- Renovar: soma a duração do plano ao fim da validade (ou a partir de agora,
-- se já expirou). Não se perdem dias pagos.
-- -----------------------------------------------------------------------------
create or replace function public.admin_renew_subscription(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._assert_admin();
  v_sub public.subscriptions;
  v_days int;
  v_from timestamptz;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if v_sub.id is null then raise exception 'Assinatura não encontrada' using errcode = 'P0002'; end if;
  if v_sub.status = 'pending' then
    raise exception 'Um pedido pendente deve ser activado, não renovado';
  end if;

  select duration_days into v_days from public.subscription_plans where id = v_sub.plan_id;
  v_from := greatest(now(), coalesce(v_sub.expires_at, now()));

  update public.subscriptions
     set status = 'active',
         starts_at = coalesce(case when v_sub.expires_at > now() then v_sub.starts_at end, now()),
         expires_at = v_from + make_interval(days => v_days),
         activated_by = v_admin
   where id = v_sub.id
  returning * into v_sub;
  return v_sub;
end;
$$;

-- -----------------------------------------------------------------------------
-- Suspender / reactivar
-- -----------------------------------------------------------------------------
create or replace function public.admin_suspend_subscription(p_subscription_id uuid, p_reason text default null)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  perform public._assert_admin();
  update public.subscriptions
     set status = 'suspended',
         notes = case
           when nullif(trim(p_reason), '') is null then notes
           else left(concat_ws(E'\n', notes, '[Suspensa] ' || trim(p_reason)), 2000)
         end
   where id = p_subscription_id and status = 'active'
  returning * into v_sub;
  if v_sub.id is null then raise exception 'Só é possível suspender uma assinatura activa'; end if;
  return v_sub;
end;
$$;

create or replace function public.admin_reactivate_subscription(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  perform public._assert_admin();
  update public.subscriptions
     set status = case when expires_at > now() then 'active' else 'expired' end::public.subscription_status
   where id = p_subscription_id and status = 'suspended'
  returning * into v_sub;
  if v_sub.id is null then raise exception 'Só é possível reactivar uma assinatura suspensa'; end if;
  return v_sub;
end;
$$;

-- -----------------------------------------------------------------------------
-- Atribuir um plano a um estudante (cria pendente ou já activa)
-- -----------------------------------------------------------------------------
create or replace function public.admin_assign_subscription(p_user_id uuid, p_plan_id uuid, p_activate boolean default true)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  perform public._assert_admin();
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Estudante não encontrado' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.subscription_plans where id = p_plan_id) then
    raise exception 'Plano não encontrado' using errcode = 'P0002';
  end if;

  if p_activate then
    -- Estado provisório (sem datas) e activação logo a seguir, na mesma transacção.
    -- Não usa "pending" para não colidir com um pedido pendente do próprio estudante.
    insert into public.subscriptions (user_id, plan_id, status)
    values (p_user_id, p_plan_id, 'expired')
    returning * into v_sub;
    return public.admin_activate_subscription(v_sub.id);
  end if;

  insert into public.subscriptions (user_id, plan_id) values (p_user_id, p_plan_id) returning * into v_sub;
  return v_sub;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registar pagamento (e opcionalmente activar/renovar a assinatura associada)
-- Tudo numa só transacção: ou fica tudo registado, ou nada.
-- -----------------------------------------------------------------------------
create or replace function public.admin_record_payment(
  p_user_id         uuid,
  p_plan_id         uuid,
  p_amount_mzn      numeric,
  p_method          public.payment_method,
  p_reference       text,
  p_paid_at         timestamptz,
  p_subscription_id uuid default null,
  p_apply           boolean default true,
  p_notes           text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._assert_admin();
  v_sub public.subscriptions;
  v_payment public.payments;
begin
  if p_subscription_id is not null then
    select * into v_sub from public.subscriptions where id = p_subscription_id and user_id = p_user_id;
    if v_sub.id is null then raise exception 'A assinatura não pertence a este estudante'; end if;
  end if;

  if p_apply then
    if v_sub.id is null then
      v_sub := public.admin_assign_subscription(p_user_id, p_plan_id, true);
    elsif v_sub.status = 'pending' then
      v_sub := public.admin_activate_subscription(v_sub.id);
    else
      v_sub := public.admin_renew_subscription(v_sub.id);
    end if;
  end if;

  insert into public.payments (user_id, subscription_id, plan_id, amount_mzn, method, reference, status, paid_at, recorded_by, notes)
  values (p_user_id, v_sub.id, coalesce(v_sub.plan_id, p_plan_id), p_amount_mzn, p_method,
          nullif(trim(p_reference), ''), 'confirmed', coalesce(p_paid_at, now()), v_admin, nullif(trim(p_notes), ''))
  returning * into v_payment;
  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function public._current_paid_until(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._assert_admin() from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_activate_subscription(uuid, timestamptz)',
    'public.admin_renew_subscription(uuid)',
    'public.admin_suspend_subscription(uuid, text)',
    'public.admin_reactivate_subscription(uuid)',
    'public.admin_assign_subscription(uuid, uuid, boolean)',
    'public.admin_record_payment(uuid, uuid, numeric, public.payment_method, text, timestamptz, uuid, boolean, text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Expiração automática: todos os dias às 22:05 UTC (= 00:05 em Maputo)
-- (o acesso já é negado pela data; isto mantém o estado "expired" coerente)
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'medstudy-expirar-assinaturas',
  '5 22 * * *',
  $cron$ select public.expire_subscriptions(); $cron$
);

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261114000900', 'subscriptions_management', '{}');

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 20261114001000_quiz_snapshot.sql
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261114001000', 'quiz_snapshot', '{}');

commit;

-- Verificação: deve mostrar 10 migrações e a tarefa diária activa (1).
select (select count(*) from supabase_migrations.schema_migrations) as migracoes,
       (select count(*) from cron.job where jobname = 'medstudy-expirar-assinaturas' and active) as tarefa_diaria;
