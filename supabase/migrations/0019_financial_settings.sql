-- Ticket #22: member financial settings and Stripe receipt links.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_preference') then
    create type public.payment_preference as enum ('manual', 'auto_pay');
  end if;
end $$;

create table if not exists public.user_financial_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_customer_id text unique,
  payment_preference public.payment_preference not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_financial_settings_payment_preference_idx on public.user_financial_settings(payment_preference);

drop trigger if exists set_user_financial_settings_updated_at on public.user_financial_settings;
create trigger set_user_financial_settings_updated_at
before update on public.user_financial_settings
for each row execute function public.set_updated_at();

alter table public.user_financial_settings enable row level security;

drop policy if exists "Users can read own financial settings" on public.user_financial_settings;
create policy "Users can read own financial settings"
on public.user_financial_settings
for select
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "Users can update own financial settings" on public.user_financial_settings;
create policy "Users can update own financial settings"
on public.user_financial_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can insert own financial settings" on public.user_financial_settings;
create policy "Users can insert own financial settings"
on public.user_financial_settings
for insert
to authenticated
with check (user_id = auth.uid());

alter table public.member_contribution_payments
add column if not exists stripe_receipt_url text;

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
  amount_remaining numeric(14, 2);
  amount_applied numeric(14, 2);
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
  );

  update public.member_contributions
  set
    amount_paid_cents = next_paid,
    status = next_status,
    recorded_by = payer_uuid,
    recorded_at = now(),
    note = 'Stripe checkout payment'
  where id = contribution_uuid;
end;
$$;

grant execute on function public.apply_stripe_member_contribution_payment(text, text, uuid, uuid, numeric, text) to service_role;
