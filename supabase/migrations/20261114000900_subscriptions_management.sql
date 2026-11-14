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
