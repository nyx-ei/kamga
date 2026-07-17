-- Ticket #23: annual fiscal slips and offline payment receipt history.
alter table public.associations
add column if not exists rpn_id text;

alter table public.member_contribution_payments
alter column stripe_checkout_session_id drop not null;

alter table public.member_contribution_payments
drop constraint if exists member_contribution_payments_provider_check;

alter table public.member_contribution_payments
add constraint member_contribution_payments_provider_check check (provider in ('stripe', 'offline'));

alter table public.member_contribution_payments
drop constraint if exists member_contribution_payments_stripe_checkout_session_id_key;

create unique index if not exists member_contribution_payments_stripe_checkout_session_unique_idx
on public.member_contribution_payments(stripe_checkout_session_id)
where stripe_checkout_session_id is not null;

create or replace function public.record_member_contribution_payment(
  contribution_uuid uuid,
  amount_paid_cents_value numeric,
  note_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  contribution_row public.member_contributions;
  call_row public.association_levee_calls;
  next_status public.member_contribution_status;
  payment_delta numeric(14, 2);
  payer_uuid uuid;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  if amount_paid_cents_value < 0 then
    raise exception 'KMG-LV-001';
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

  if not (public.is_platform_admin() or public.is_association_admin(call_row.association_id)) then
    raise exception 'KMG-AUTH-403';
  end if;

  if amount_paid_cents_value > contribution_row.amount_due_cents then
    raise exception 'KMG-LV-001';
  end if;

  select user_id
  into payer_uuid
  from public.association_members
  where id = contribution_row.membership_id;

  payment_delta := greatest(amount_paid_cents_value - contribution_row.amount_paid_cents, 0);
  next_status := case
    when amount_paid_cents_value = 0 then 'unpaid'::public.member_contribution_status
    when amount_paid_cents_value < contribution_row.amount_due_cents then 'partial'::public.member_contribution_status
    else 'paid'::public.member_contribution_status
  end;

  if payment_delta > 0 then
    insert into public.member_contribution_payments (
      contribution_id,
      provider,
      payer_user_id,
      amount_received_cents,
      amount_applied_cents,
      overpayment_cents
    )
    values (
      contribution_uuid,
      'offline',
      payer_uuid,
      payment_delta,
      payment_delta,
      0
    );
  end if;

  update public.member_contributions
  set
    amount_paid_cents = amount_paid_cents_value,
    status = next_status,
    recorded_by = auth.uid(),
    recorded_at = now(),
    note = nullif(trim(coalesce(note_value, '')), '')
  where id = contribution_uuid;
end;
$$;

grant execute on function public.record_member_contribution_payment(uuid, numeric, text) to authenticated;
