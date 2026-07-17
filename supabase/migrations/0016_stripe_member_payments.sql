-- Ticket #18: Stripe online payments for member contributions.
create table if not exists public.member_contribution_payments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.member_contributions(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  payer_user_id uuid references public.users(id) on delete set null,
  amount_received_cents numeric(14, 2) not null check (amount_received_cents >= 0),
  amount_applied_cents numeric(14, 2) not null check (amount_applied_cents >= 0),
  overpayment_cents numeric(14, 2) not null default 0 check (overpayment_cents >= 0),
  status text not null default 'succeeded' check (status in ('succeeded')),
  created_at timestamptz not null default now()
);

create index if not exists member_contribution_payments_contribution_id_idx on public.member_contribution_payments(contribution_id);
create index if not exists member_contribution_payments_payer_user_id_idx on public.member_contribution_payments(payer_user_id);

alter table public.member_contribution_payments enable row level security;

drop policy if exists "Platform admins can read contribution payments" on public.member_contribution_payments;
create policy "Platform admins can read contribution payments"
on public.member_contribution_payments
for select
to authenticated
using (public.is_platform_admin());

drop policy if exists "Association admins can read own contribution payments" on public.member_contribution_payments;
create policy "Association admins can read own contribution payments"
on public.member_contribution_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.member_contributions contributions
    join public.association_levee_calls calls on calls.id = contributions.association_levee_call_id
    where contributions.id = member_contribution_payments.contribution_id
      and public.is_association_admin(calls.association_id)
  )
);

drop policy if exists "Members can read own contribution payments" on public.member_contribution_payments;
create policy "Members can read own contribution payments"
on public.member_contribution_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.member_contributions contributions
    join public.association_members memberships on memberships.id = contributions.membership_id
    where contributions.id = member_contribution_payments.contribution_id
      and memberships.user_id = auth.uid()
  )
);

create or replace function public.apply_stripe_member_contribution_payment(
  checkout_session_id_value text,
  payment_intent_id_value text,
  contribution_uuid uuid,
  payer_uuid uuid,
  amount_received_cents_value numeric
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
    payer_user_id,
    amount_received_cents,
    amount_applied_cents,
    overpayment_cents
  )
  values (
    contribution_uuid,
    checkout_session_id_value,
    nullif(trim(coalesce(payment_intent_id_value, '')), ''),
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

grant execute on function public.apply_stripe_member_contribution_payment(text, text, uuid, uuid, numeric) to service_role;
