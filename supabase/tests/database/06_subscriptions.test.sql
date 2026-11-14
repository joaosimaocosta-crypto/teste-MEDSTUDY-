-- =============================================================================
-- MEDSTUDY MOZ — Testes da gestão de assinaturas e pagamentos (pgTAP)
-- Plano do seed: …9001, 30 dias, acesso a todos os cursos
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('abababab-0000-0000-0000-000000000001', 'sub1@teste.local', '{}', 'authenticated', 'authenticated'),
  ('abababab-0000-0000-0000-000000000002', 'sub2@teste.local', '{}', 'authenticated', 'authenticated'),
  ('abababab-0000-0000-0000-000000000009', 'subadmin@teste.local', '{}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'abababab-0000-0000-0000-000000000009';

-- ---- Estudante: pede um plano -------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"abababab-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.subscriptions (id, user_id, plan_id, notes)
     values ('cdcdcdcd-0000-0000-0000-000000000001', 'abababab-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'M-Pesa ref ABC123') $$,
  'Estudante pede um plano (pendente) com referência'
);
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan_id) values ('abababab-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001') $$,
  '23505', null, 'Não pode ter dois pedidos pendentes'
);
select is(public.has_course_access('10000000-0000-0000-0000-000000000001'), false, 'Pedido pendente ainda não dá acesso');
select throws_ok(
  $$ select public.admin_activate_subscription('cdcdcdcd-0000-0000-0000-000000000001') $$,
  '42501', null, 'Estudante não consegue activar a própria assinatura'
);
select throws_ok(
  $$ select public.admin_record_payment('abababab-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 0, 'mpesa', 'X', now()) $$,
  '42501', null, 'Estudante não regista pagamentos'
);
select is((select count(*)::int from public.app_settings), 1, 'Estudante lê as instruções de pagamento');
create temp table _settings_before as select payment_instructions from public.app_settings;
update public.app_settings set payment_instructions = 'hack';
select is(
  (select payment_instructions from public.app_settings),
  (select payment_instructions from _settings_before),
  'Estudante não altera as instruções de pagamento'
);

-- ---- Administrador ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"abababab-0000-0000-0000-000000000009","role":"authenticated"}';

select lives_ok(
  $$ update public.app_settings set payment_instructions = 'Pague por M-Pesa', support_contact = 'suporte@exemplo.invalid' $$,
  'Admin altera as instruções de pagamento'
);

select is(
  (select status::text || '|' || (expires_at - starts_at = interval '30 days') || '|' || (activated_by is not null)
     from public.admin_activate_subscription('cdcdcdcd-0000-0000-0000-000000000001')),
  'active|true|true', 'Activar: 30 dias, registando quem activou'
);

-- Renovar: soma 30 dias ao fim da validade (não a partir de hoje)
create temp table _exp as select expires_at from public.subscriptions where id = 'cdcdcdcd-0000-0000-0000-000000000001';
select is(
  (select expires_at from public.admin_renew_subscription('cdcdcdcd-0000-0000-0000-000000000001')),
  (select expires_at + interval '30 days' from _exp), 'Renovar: +30 dias a partir do fim da validade'
);

select is(
  (select status::text from public.admin_suspend_subscription('cdcdcdcd-0000-0000-0000-000000000001', 'Pagamento contestado')),
  'suspended', 'Suspender'
);
select ok(
  (select notes like '%[Suspensa] Pagamento contestado%' and notes like 'M-Pesa ref ABC123%' from public.subscriptions where id = 'cdcdcdcd-0000-0000-0000-000000000001'),
  'Motivo da suspensão acrescentado sem apagar a nota do estudante'
);
select throws_ok(
  $$ select public.admin_suspend_subscription('cdcdcdcd-0000-0000-0000-000000000001') $$,
  null, 'Só é possível suspender uma assinatura activa', 'Não suspende duas vezes'
);

-- Estudante perde acesso enquanto suspensa
set local request.jwt.claims = '{"sub":"abababab-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.has_course_access('10000000-0000-0000-0000-000000000001'), false, 'Suspensa → sem acesso');
set local request.jwt.claims = '{"sub":"abababab-0000-0000-0000-000000000009","role":"authenticated"}';

select is(
  (select status::text from public.admin_reactivate_subscription('cdcdcdcd-0000-0000-0000-000000000001')),
  'active', 'Reactivar (ainda dentro da validade)'
);
set local request.jwt.claims = '{"sub":"abababab-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.has_course_access('10000000-0000-0000-0000-000000000001'), true, 'Reactivada → acesso de volta');
set local request.jwt.claims = '{"sub":"abababab-0000-0000-0000-000000000009","role":"authenticated"}';

-- Registar pagamento sem assinatura → cria e activa
create temp table _pay as
  select * from public.admin_record_payment('abababab-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001',
    450, 'emola', ' EM-777 ', now(), null, true, 'Pago no balcão');
select is((select status::text || '|' || reference from _pay), 'confirmed|EM-777', 'Pagamento registado (referência limpa)');
select is(
  (select s.status::text from public.subscriptions s join _pay p on p.subscription_id = s.id),
  'active', 'Pagamento com "aplicar" cria e activa a assinatura'
);

-- Segundo pagamento do mesmo estudante → renova (continua do fim da validade)
create temp table _exp2 as select s.expires_at from public.subscriptions s join _pay p on p.subscription_id = s.id;
select public.admin_record_payment('abababab-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001',
  450, 'mpesa', 'MP-2', now(), (select subscription_id from _pay), true);
select is(
  (select s.expires_at from public.subscriptions s join _pay p on p.subscription_id = s.id),
  (select expires_at + interval '30 days' from _exp2), 'Segundo pagamento renova sem perder dias'
);
select throws_ok(
  $$ select public.admin_record_payment('abababab-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 1, 'cash', null, now(), 'cdcdcdcd-0000-0000-0000-000000000001', true) $$,
  null, 'A assinatura não pertence a este estudante', 'Não associa pagamento à assinatura de outro estudante'
);

-- Nova assinatura começa quando a actual termina
create temp table _new as select * from public.admin_assign_subscription('abababab-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', true);
select is(
  (select starts_at from _new),
  (select expires_at from public.subscriptions where id = 'cdcdcdcd-0000-0000-0000-000000000001'),
  'Nova assinatura começa no fim da actual (sem sobreposição)'
);

-- Expiração automática
reset role;
update public.subscriptions set starts_at = now() - interval '40 days', expires_at = now() - interval '1 day'
  where id = 'cdcdcdcd-0000-0000-0000-000000000001';
select ok(public.expire_subscriptions() >= 1, 'expire_subscriptions marca vencidas');
select is((select status::text from public.subscriptions where id = 'cdcdcdcd-0000-0000-0000-000000000001'), 'expired', 'Assinatura vencida fica "expired"');
select is(
  (select schedule from cron.job where jobname = 'medstudy-expirar-assinaturas'),
  '5 22 * * *', 'Tarefa diária agendada (00:05 em Maputo)'
);

select * from finish();
rollback;
