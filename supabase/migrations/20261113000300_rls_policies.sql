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
