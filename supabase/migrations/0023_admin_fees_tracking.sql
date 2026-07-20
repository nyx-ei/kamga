-- Ticket #26: admin fees tracking and payout support.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_fee_model') then
    create type public.admin_fee_model as enum ('per_member', 'per_levee');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_fee_payout_method') then
    create type public.admin_fee_payout_method as enum ('manual', 'stripe_connect');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_fee_status') then
    create type public.admin_fee_status as enum ('accrued', 'payout_pending', 'paid', 'waived');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_fee_payout_status') then
    create type public.admin_fee_payout_status as enum ('pending', 'processing', 'paid', 'failed');
  end if;
end
$$;

create table if not exists public.association_admin_fee_settings (
  association_id uuid primary key references public.associations(id) on delete cascade,
  fee_model public.admin_fee_model not null default 'per_member',
  fee_bps integer not null default 250 check (fee_bps >= 0 and fee_bps <= 10000),
  fee_fixed_cents numeric(14, 2) not null default 0 check (fee_fixed_cents >= 0),
  payout_method public.admin_fee_payout_method not null default 'manual',
  stripe_connect_account_id text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.association_admin_fee_payouts (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  association_admin_user_id uuid not null references public.users(id) on delete cascade,
  method public.admin_fee_payout_method not null,
  status public.admin_fee_payout_status not null default 'pending',
  amount_cents numeric(14, 2) not null check (amount_cents >= 0),
  stripe_transfer_id text,
  failure_reason text,
  created_by uuid references public.users(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.association_admin_fees (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  association_admin_user_id uuid not null references public.users(id) on delete cascade,
  contribution_id uuid references public.member_contributions(id) on delete set null,
  payment_id uuid references public.member_contribution_payments(id) on delete set null,
  payout_id uuid references public.association_admin_fee_payouts(id) on delete set null,
  fee_model public.admin_fee_model not null,
  source_amount_cents numeric(14, 2) not null check (source_amount_cents >= 0),
  fee_amount_cents numeric(14, 2) not null check (fee_amount_cents >= 0),
  status public.admin_fee_status not null default 'accrued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint association_admin_fees_unique_payment_admin unique (payment_id, association_admin_user_id)
);

create index if not exists association_admin_fee_settings_payout_method_idx on public.association_admin_fee_settings(payout_method);
create index if not exists association_admin_fee_payouts_association_id_idx on public.association_admin_fee_payouts(association_id);
create index if not exists association_admin_fee_payouts_admin_user_id_idx on public.association_admin_fee_payouts(association_admin_user_id);
create index if not exists association_admin_fee_payouts_status_idx on public.association_admin_fee_payouts(status);
create index if not exists association_admin_fees_association_id_idx on public.association_admin_fees(association_id);
create index if not exists association_admin_fees_admin_user_id_idx on public.association_admin_fees(association_admin_user_id);
create index if not exists association_admin_fees_contribution_id_idx on public.association_admin_fees(contribution_id);
create index if not exists association_admin_fees_payment_id_idx on public.association_admin_fees(payment_id);
create index if not exists association_admin_fees_status_idx on public.association_admin_fees(status);

drop trigger if exists set_association_admin_fee_settings_updated_at on public.association_admin_fee_settings;
create trigger set_association_admin_fee_settings_updated_at
before update on public.association_admin_fee_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_association_admin_fees_updated_at on public.association_admin_fees;
create trigger set_association_admin_fees_updated_at
before update on public.association_admin_fees
for each row execute function public.set_updated_at();

alter table public.association_admin_fee_settings enable row level security;
alter table public.association_admin_fees enable row level security;
alter table public.association_admin_fee_payouts enable row level security;

drop policy if exists "Platform admins can manage admin fee settings" on public.association_admin_fee_settings;
create policy "Platform admins can manage admin fee settings"
on public.association_admin_fee_settings
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can read own fee settings" on public.association_admin_fee_settings;
create policy "Association admins can read own fee settings"
on public.association_admin_fee_settings
for select
to authenticated
using (public.is_association_admin(association_id));

drop policy if exists "Platform admins can manage admin fees" on public.association_admin_fees;
create policy "Platform admins can manage admin fees"
on public.association_admin_fees
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can read own accrued fees" on public.association_admin_fees;
create policy "Association admins can read own accrued fees"
on public.association_admin_fees
for select
to authenticated
using (association_admin_user_id = auth.uid() or public.is_association_admin(association_id));

drop policy if exists "Platform admins can manage admin fee payouts" on public.association_admin_fee_payouts;
create policy "Platform admins can manage admin fee payouts"
on public.association_admin_fee_payouts
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can read own admin fee payouts" on public.association_admin_fee_payouts;
create policy "Association admins can read own admin fee payouts"
on public.association_admin_fee_payouts
for select
to authenticated
using (association_admin_user_id = auth.uid() or public.is_association_admin(association_id));

create or replace view public.association_admin_fee_balances
with (security_invoker = true)
as
select
  fees.association_id,
  fees.association_admin_user_id,
  coalesce(sum(fees.fee_amount_cents) filter (where fees.status = 'accrued'), 0)::numeric(14, 2) as accrued_amount_cents,
  coalesce(sum(fees.fee_amount_cents) filter (where fees.status = 'payout_pending'), 0)::numeric(14, 2) as pending_payout_amount_cents,
  coalesce(sum(fees.fee_amount_cents) filter (where fees.status = 'paid'), 0)::numeric(14, 2) as paid_amount_cents,
  coalesce(sum(fees.fee_amount_cents), 0)::numeric(14, 2) as total_amount_cents,
  count(fees.id) filter (where fees.status = 'accrued')::integer as accrued_fee_count,
  max(fees.created_at) as latest_fee_at
from public.association_admin_fees fees
group by fees.association_id, fees.association_admin_user_id;

grant select on public.association_admin_fee_balances to authenticated;

create or replace view public.member_contribution_fee_transparency
with (security_invoker = true)
as
select
  contributions.id as contribution_id,
  calls.association_id,
  coalesce(settings.is_enabled, true) as is_enabled,
  coalesce(settings.fee_model, 'per_member'::public.admin_fee_model) as fee_model,
  coalesce(settings.fee_bps, 250) as fee_bps,
  coalesce(settings.fee_fixed_cents, 0)::numeric(14, 2) as fee_fixed_cents,
  case
    when coalesce(settings.is_enabled, true) then round((contributions.amount_due_cents * coalesce(settings.fee_bps, 250)::numeric / 10000) + coalesce(settings.fee_fixed_cents, 0), 2)
    else 0
  end::numeric(14, 2) as estimated_fee_cents
from public.member_contributions contributions
join public.association_levee_calls calls on calls.id = contributions.association_levee_call_id
left join public.association_admin_fee_settings settings on settings.association_id = calls.association_id;

grant select on public.member_contribution_fee_transparency to authenticated;

create or replace function public.apply_stripe_member_contribution_payment(
  checkout_session_id_value text,
  payment_intent_id_value text,
  contribution_uuid uuid,
  payer_uuid uuid,
  amount_received_cents_value numeric,
  receipt_url_value text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  contribution_row public.member_contributions;
  call_row public.association_levee_calls;
  fee_settings public.association_admin_fee_settings;
  admin_row record;
  inserted_payment_id uuid;
  amount_remaining numeric(14, 2);
  amount_applied numeric(14, 2);
  fee_amount numeric(14, 2);
  next_paid numeric(14, 2);
  next_status public.member_contribution_status;
begin
  if checkout_session_id_value is null or char_length(trim(checkout_session_id_value)) = 0 then
    raise exception 'KMG-PAY-001';
  end if;

  if amount_received_cents_value < 0 then
    raise exception 'KMG-PAY-001';
  end if;

  if exists (
    select 1
    from public.member_contribution_payments
    where stripe_checkout_session_id = checkout_session_id_value
  ) then
    return;
  end if;

  select *
  into contribution_row
  from public.member_contributions
  where id = contribution_uuid
  for update;

  if contribution_row.id is null then
    raise exception 'KMG-LV-404';
  end if;

  select *
  into call_row
  from public.association_levee_calls
  where id = contribution_row.association_levee_call_id;

  amount_remaining := greatest(contribution_row.amount_due_cents - contribution_row.amount_paid_cents, 0);
  amount_applied := least(amount_received_cents_value, amount_remaining);
  next_paid := contribution_row.amount_paid_cents + amount_applied;
  next_status := case
    when next_paid = 0 then 'unpaid'::public.member_contribution_status
    when next_paid < contribution_row.amount_due_cents then 'partial'::public.member_contribution_status
    else 'paid'::public.member_contribution_status
  end;

  insert into public.member_contribution_payments (
    contribution_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_receipt_url,
    payer_user_id,
    amount_received_cents,
    amount_applied_cents,
    overpayment_cents
  )
  values (
    contribution_uuid,
    checkout_session_id_value,
    nullif(trim(coalesce(payment_intent_id_value, '')), ''),
    nullif(trim(coalesce(receipt_url_value, '')), ''),
    payer_uuid,
    amount_received_cents_value,
    amount_applied,
    greatest(amount_received_cents_value - amount_applied, 0)
  )
  returning id into inserted_payment_id;

  update public.member_contributions
  set
    amount_paid_cents = next_paid,
    status = next_status,
    recorded_by = payer_uuid,
    recorded_at = now(),
    note = 'Stripe checkout payment'
  where id = contribution_uuid;

  select *
  into fee_settings
  from public.association_admin_fee_settings
  where association_id = call_row.association_id;

  if coalesce(fee_settings.is_enabled, true) and amount_applied > 0 then
    for admin_row in
      select memberships.user_id
      from public.association_members memberships
      where memberships.association_id = call_row.association_id
        and memberships.role = 'association_admin'
        and memberships.status = 'active'
    loop
      fee_amount := round((amount_applied * coalesce(fee_settings.fee_bps, 250)::numeric / 10000) + coalesce(fee_settings.fee_fixed_cents, 0), 2);

      if fee_amount > 0 then
        insert into public.association_admin_fees (
          association_id,
          association_admin_user_id,
          contribution_id,
          payment_id,
          fee_model,
          source_amount_cents,
          fee_amount_cents
        )
        values (
          call_row.association_id,
          admin_row.user_id,
          contribution_uuid,
          inserted_payment_id,
          coalesce(fee_settings.fee_model, 'per_member'::public.admin_fee_model),
          amount_applied,
          fee_amount
        )
        on conflict (payment_id, association_admin_user_id) do nothing;
      end if;
    end loop;
  end if;
end;
$$;

grant execute on function public.apply_stripe_member_contribution_payment(text, text, uuid, uuid, numeric, text) to service_role;
