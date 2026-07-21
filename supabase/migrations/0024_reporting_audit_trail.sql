-- Ticket #27: reporting views and audit trail.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_columns text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_table_name_idx on public.audit_logs(table_name);
create index if not exists audit_logs_record_id_idx on public.audit_logs(record_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "Platform admins can read audit logs" on public.audit_logs;
create policy "Platform admins can read audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_platform_admin());

create or replace function public.audit_changed_columns(old_row jsonb, new_row jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(key order by key), '{}')
  from (
    select coalesce(old_values.key, new_values.key) as key
    from jsonb_each(old_row) old_values
    full join jsonb_each(new_row) new_values on new_values.key = old_values.key
    where old_values.value is distinct from new_values.value
  ) changed
  where key not in ('updated_at')
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uuid uuid;
  changed text[];
  current_row jsonb;
  previous_row jsonb;
  row_uuid uuid;
begin
  actor_uuid := auth.uid();
  current_row := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  previous_row := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  row_uuid := nullif(coalesce(current_row ->> 'id', previous_row ->> 'id'), '')::uuid;

  if tg_op = 'UPDATE' then
    changed := public.audit_changed_columns(previous_row, current_row);

    if array_length(changed, 1) is null then
      return new;
    end if;
  else
    changed := '{}';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    table_name,
    record_id,
    action,
    changed_columns,
    metadata
  )
  values (
    actor_uuid,
    tg_table_name,
    row_uuid,
    tg_op,
    changed,
    jsonb_build_object(
      'schema', tg_table_schema,
      'status_before', previous_row ->> 'status',
      'status_after', current_row ->> 'status',
      'role_before', previous_row ->> 'role',
      'role_after', current_row ->> 'role'
    )
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.attach_audit_trigger(table_name_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = table_name_value
  ) then
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name_value, table_name_value);
    execute format(
      'create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      table_name_value,
      table_name_value
    );
  end if;
end;
$$;

select public.attach_audit_trigger(table_name_value)
from (
  values
    ('associations'),
    ('association_members'),
    ('association_member_review_events'),
    ('association_admin_fee_settings'),
    ('association_admin_fees'),
    ('association_admin_fee_payouts'),
    ('association_levee_calls'),
    ('evidence_uploads'),
    ('levees'),
    ('member_contribution_payments'),
    ('member_contributions'),
    ('member_dependents'),
    ('notifications'),
    ('pilot_associations'),
    ('pilot_feedback'),
    ('referral_tokens'),
    ('user_financial_settings'),
    ('user_roles'),
    ('users')
) audited(table_name_value);

create or replace view public.levee_reports
with (security_invoker = true)
as
select
  levees.id as levee_id,
  levees.deceased_full_name,
  levees.target_amount_cents,
  levees.deadline,
  levees.status,
  levees.pool_size,
  levees.per_share_amount_cents,
  progress.collected_amount_cents,
  progress.outstanding_amount_cents,
  progress.association_count,
  progress.remitted_association_count,
  case
    when levees.target_amount_cents > 0 then round((progress.collected_amount_cents / levees.target_amount_cents) * 100, 2)
    else 0
  end::numeric(6, 2) as collection_rate,
  min(payments.created_at) as first_payment_at,
  max(payments.created_at) as latest_payment_at,
  levees.created_at
from public.levees levees
join public.levee_collection_progress progress on progress.levee_id = levees.id
left join public.association_levee_calls calls on calls.levee_id = levees.id
left join public.member_contributions contributions on contributions.association_levee_call_id = calls.id
left join public.member_contribution_payments payments on payments.contribution_id = contributions.id
group by
  levees.id,
  levees.deceased_full_name,
  levees.target_amount_cents,
  levees.deadline,
  levees.status,
  levees.pool_size,
  levees.per_share_amount_cents,
  progress.collected_amount_cents,
  progress.outstanding_amount_cents,
  progress.association_count,
  progress.remitted_association_count,
  levees.created_at;

grant select on public.levee_reports to authenticated;

create or replace view public.levee_association_breakdown
with (security_invoker = true)
as
select
  summary.levee_id,
  summary.association_levee_call_id,
  summary.association_id,
  associations.name as association_name,
  associations.city as association_city,
  calls.share_count,
  summary.target_amount_cents,
  summary.collected_amount_cents,
  summary.outstanding_amount_cents,
  summary.member_count,
  summary.paid_member_count,
  summary.partial_member_count,
  summary.unpaid_member_count,
  calls.status as call_status,
  summary.remitted_at,
  case
    when summary.target_amount_cents > 0 then round((summary.collected_amount_cents / summary.target_amount_cents) * 100, 2)
    else 0
  end::numeric(6, 2) as collection_rate
from public.association_levee_collection_summary summary
join public.association_levee_calls calls on calls.id = summary.association_levee_call_id
join public.associations associations on associations.id = summary.association_id;

grant select on public.levee_association_breakdown to authenticated;

create or replace view public.member_contribution_report
with (security_invoker = true)
as
select
  contributions.id as contribution_id,
  memberships.id as membership_id,
  memberships.association_id,
  memberships.user_id,
  users.email,
  users.first_name,
  users.last_name,
  associations.name as association_name,
  calls.levee_id,
  levees.deceased_full_name,
  contributions.share_count,
  contributions.amount_due_cents,
  contributions.amount_paid_cents,
  contributions.status,
  contributions.created_at,
  contributions.recorded_at,
  coalesce(sum(payments.amount_applied_cents), 0)::numeric(14, 2) as total_payment_history_cents,
  count(payments.id)::integer as payment_count
from public.member_contributions contributions
join public.association_members memberships on memberships.id = contributions.membership_id
join public.users users on users.id = memberships.user_id
join public.associations associations on associations.id = memberships.association_id
join public.association_levee_calls calls on calls.id = contributions.association_levee_call_id
join public.levees levees on levees.id = calls.levee_id
left join public.member_contribution_payments payments on payments.contribution_id = contributions.id
group by
  contributions.id,
  memberships.id,
  memberships.association_id,
  memberships.user_id,
  users.email,
  users.first_name,
  users.last_name,
  associations.name,
  calls.levee_id,
  levees.deceased_full_name,
  contributions.share_count,
  contributions.amount_due_cents,
  contributions.amount_paid_cents,
  contributions.status,
  contributions.created_at,
  contributions.recorded_at;

grant select on public.member_contribution_report to authenticated;

create or replace view public.member_fiscal_summary_report
with (security_invoker = true)
as
select
  memberships.user_id,
  memberships.association_id,
  associations.name as association_name,
  extract(year from payments.created_at)::integer as fiscal_year,
  coalesce(sum(payments.amount_applied_cents), 0)::numeric(14, 2) as total_contributed_cents,
  count(payments.id)::integer as payment_count,
  min(payments.created_at) as first_payment_at,
  max(payments.created_at) as latest_payment_at
from public.member_contribution_payments payments
join public.member_contributions contributions on contributions.id = payments.contribution_id
join public.association_members memberships on memberships.id = contributions.membership_id
join public.associations associations on associations.id = memberships.association_id
group by memberships.user_id, memberships.association_id, associations.name, extract(year from payments.created_at);

grant select on public.member_fiscal_summary_report to authenticated;

create or replace view public.admin_member_roster_report
with (security_invoker = true)
as
select
  memberships.id as membership_id,
  memberships.association_id,
  associations.name as association_name,
  memberships.user_id,
  users.email,
  users.first_name,
  users.last_name,
  memberships.role,
  memberships.status,
  (1 + count(dependents.id))::integer as share_count,
  memberships.created_at,
  memberships.reviewed_at
from public.association_members memberships
join public.associations associations on associations.id = memberships.association_id
join public.users users on users.id = memberships.user_id
left join public.member_dependents dependents on dependents.membership_id = memberships.id
group by
  memberships.id,
  memberships.association_id,
  associations.name,
  memberships.user_id,
  users.email,
  users.first_name,
  users.last_name,
  memberships.role,
  memberships.status,
  memberships.created_at,
  memberships.reviewed_at;

grant select on public.admin_member_roster_report to authenticated;

create or replace view public.admin_fee_earnings_report
with (security_invoker = true)
as
select
  balances.association_id,
  associations.name as association_name,
  balances.association_admin_user_id,
  users.email as admin_email,
  users.first_name as admin_first_name,
  users.last_name as admin_last_name,
  balances.accrued_amount_cents,
  balances.pending_payout_amount_cents,
  balances.paid_amount_cents,
  balances.total_amount_cents,
  balances.accrued_fee_count,
  balances.latest_fee_at
from public.association_admin_fee_balances balances
join public.associations associations on associations.id = balances.association_id
join public.users users on users.id = balances.association_admin_user_id;

grant select on public.admin_fee_earnings_report to authenticated;
