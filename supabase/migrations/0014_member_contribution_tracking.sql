-- Ticket #17: member-level collection and progress tracking.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_contribution_status') then
    create type public.member_contribution_status as enum ('unpaid', 'partial', 'paid');
  end if;
end
$$;

create table if not exists public.member_contributions (
  id uuid primary key default gen_random_uuid(),
  association_levee_call_id uuid not null references public.association_levee_calls(id) on delete cascade,
  membership_id uuid not null references public.association_members(id) on delete cascade,
  share_count integer not null check (share_count > 0),
  amount_due_cents numeric(14, 2) not null check (amount_due_cents > 0),
  amount_paid_cents numeric(14, 2) not null default 0 check (amount_paid_cents >= 0),
  status public.member_contribution_status not null default 'unpaid',
  recorded_by uuid references public.users(id) on delete set null,
  recorded_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_contributions_unique unique (association_levee_call_id, membership_id),
  constraint member_contributions_amount_paid_lte_due check (amount_paid_cents <= amount_due_cents)
);

create index if not exists member_contributions_call_id_idx on public.member_contributions(association_levee_call_id);
create index if not exists member_contributions_membership_id_idx on public.member_contributions(membership_id);
create index if not exists member_contributions_status_idx on public.member_contributions(status);

drop trigger if exists set_member_contributions_updated_at on public.member_contributions;
create trigger set_member_contributions_updated_at
before update on public.member_contributions
for each row
execute function public.set_updated_at();

alter table public.member_contributions enable row level security;

drop policy if exists "Platform admins can manage member contributions" on public.member_contributions;
create policy "Platform admins can manage member contributions"
on public.member_contributions
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can manage own member contributions" on public.member_contributions;
create policy "Association admins can manage own member contributions"
on public.member_contributions
for all
to authenticated
using (
  exists (
    select 1
    from public.association_levee_calls calls
    where calls.id = member_contributions.association_levee_call_id
      and public.is_association_admin(calls.association_id)
  )
)
with check (
  exists (
    select 1
    from public.association_levee_calls calls
    where calls.id = member_contributions.association_levee_call_id
      and public.is_association_admin(calls.association_id)
  )
);

drop policy if exists "Members can read own contributions" on public.member_contributions;
create policy "Members can read own contributions"
on public.member_contributions
for select
to authenticated
using (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = member_contributions.membership_id
      and memberships.user_id = auth.uid()
  )
);

create or replace view public.association_levee_collection_progress
with (security_invoker = true)
as
select
  calls.id as association_levee_call_id,
  calls.association_id,
  calls.levee_id,
  calls.amount_due_cents as target_amount_cents,
  coalesce(sum(contributions.amount_paid_cents), 0)::numeric(14, 2) as collected_amount_cents,
  count(contributions.id)::integer as member_count,
  count(contributions.id) filter (where contributions.status = 'paid')::integer as paid_member_count,
  count(contributions.id) filter (where contributions.status = 'partial')::integer as partial_member_count,
  count(contributions.id) filter (where contributions.status = 'unpaid')::integer as unpaid_member_count
from public.association_levee_calls calls
left join public.member_contributions contributions on contributions.association_levee_call_id = calls.id
group by calls.id, calls.association_id, calls.levee_id, calls.amount_due_cents;

grant select on public.association_levee_collection_progress to authenticated;

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

  next_status := case
    when amount_paid_cents_value = 0 then 'unpaid'::public.member_contribution_status
    when amount_paid_cents_value < contribution_row.amount_due_cents then 'partial'::public.member_contribution_status
    else 'paid'::public.member_contribution_status
  end;

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

create or replace function public.create_levee(
  deceased_full_name_value text,
  deceased_city_value text,
  deceased_date_of_death_value date,
  target_amount_cents_value bigint,
  deadline_value date
)
returns table (
  id uuid,
  pool_size integer,
  per_share_amount_cents numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_pool_size integer;
  created_levee public.levees;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  if not public.is_platform_admin() then
    raise exception 'KMG-AUTH-403';
  end if;

  if target_amount_cents_value <= 0 or deadline_value < current_date or char_length(trim(deceased_full_name_value)) < 2 then
    raise exception 'KMG-LV-001';
  end if;

  select public.current_total_share_count() into computed_pool_size;

  if computed_pool_size <= 0 then
    raise exception 'KMG-LV-002';
  end if;

  insert into public.levees (
    deceased_full_name,
    deceased_city,
    deceased_date_of_death,
    target_amount_cents,
    deadline,
    pool_size,
    per_share_amount_cents,
    created_by
  )
  values (
    trim(deceased_full_name_value),
    nullif(trim(coalesce(deceased_city_value, '')), ''),
    deceased_date_of_death_value,
    target_amount_cents_value,
    deadline_value,
    computed_pool_size,
    round(target_amount_cents_value::numeric / computed_pool_size::numeric, 2),
    auth.uid()
  )
  returning * into created_levee;

  insert into public.association_levee_calls (levee_id, association_id, share_count, amount_due_cents)
  select
    created_levee.id,
    share_totals.association_id,
    share_totals.total_shares,
    round(share_totals.total_shares::numeric * created_levee.per_share_amount_cents, 2)
  from public.association_share_totals share_totals
  where share_totals.total_shares > 0;

  insert into public.member_contributions (association_levee_call_id, membership_id, share_count, amount_due_cents)
  select
    calls.id,
    memberships.id,
    (1 + count(dependents.id))::integer as share_count,
    round((1 + count(dependents.id))::numeric * created_levee.per_share_amount_cents, 2) as amount_due_cents
  from public.association_levee_calls calls
  join public.association_members memberships on memberships.association_id = calls.association_id
  left join public.member_dependents dependents on dependents.membership_id = memberships.id
  where calls.levee_id = created_levee.id
    and memberships.status = 'active'
  group by calls.id, memberships.id;

  return query
  select created_levee.id, created_levee.pool_size, created_levee.per_share_amount_cents;
end;
$$;

grant execute on function public.create_levee(text, text, date, bigint, date) to authenticated;

insert into public.member_contributions (association_levee_call_id, membership_id, share_count, amount_due_cents)
select
  calls.id,
  memberships.id,
  (1 + count(dependents.id))::integer as share_count,
  round((1 + count(dependents.id))::numeric * levees.per_share_amount_cents, 2) as amount_due_cents
from public.association_levee_calls calls
join public.levees levees on levees.id = calls.levee_id
join public.association_members memberships on memberships.association_id = calls.association_id
left join public.member_dependents dependents on dependents.membership_id = memberships.id
where memberships.status = 'active'
group by calls.id, memberships.id, levees.per_share_amount_cents
on conflict (association_levee_call_id, membership_id) do nothing;
