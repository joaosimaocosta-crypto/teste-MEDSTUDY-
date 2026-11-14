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
