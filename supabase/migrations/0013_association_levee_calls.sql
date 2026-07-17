-- Ticket #16: association-level levee dispatch and status tracking.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'association_levee_call_status') then
    create type public.association_levee_call_status as enum ('pending', 'in_progress', 'completed');
  end if;
end
$$;

create table if not exists public.association_levee_calls (
  id uuid primary key default gen_random_uuid(),
  levee_id uuid not null references public.levees(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  share_count integer not null check (share_count > 0),
  amount_due_cents numeric(14, 2) not null check (amount_due_cents > 0),
  status public.association_levee_call_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint association_levee_calls_unique unique (levee_id, association_id)
);

create index if not exists association_levee_calls_levee_id_idx on public.association_levee_calls(levee_id);
create index if not exists association_levee_calls_association_id_idx on public.association_levee_calls(association_id);
create index if not exists association_levee_calls_status_idx on public.association_levee_calls(status);

drop trigger if exists set_association_levee_calls_updated_at on public.association_levee_calls;
create trigger set_association_levee_calls_updated_at
before update on public.association_levee_calls
for each row
execute function public.set_updated_at();

alter table public.association_levee_calls enable row level security;

drop policy if exists "Platform admins can manage association levee calls" on public.association_levee_calls;
create policy "Platform admins can manage association levee calls"
on public.association_levee_calls
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can read own levee calls" on public.association_levee_calls;
create policy "Association admins can read own levee calls"
on public.association_levee_calls
for select
to authenticated
using (public.is_association_admin(association_id));

drop policy if exists "Association admins can read levees with own calls" on public.levees;
create policy "Association admins can read levees with own calls"
on public.levees
for select
to authenticated
using (
  exists (
    select 1
    from public.association_levee_calls calls
    where calls.levee_id = levees.id
      and public.is_association_admin(calls.association_id)
  )
);

create or replace function public.update_association_levee_call_status(
  call_uuid uuid,
  status_value public.association_levee_call_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  call_row public.association_levee_calls;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  if status_value not in ('pending', 'in_progress', 'completed') then
    raise exception 'KMG-LV-001';
  end if;

  select *
  into call_row
  from public.association_levee_calls
  where id = call_uuid
  for update;

  if call_row.id is null then
    raise exception 'KMG-LV-404';
  end if;

  if not (public.is_platform_admin() or public.is_association_admin(call_row.association_id)) then
    raise exception 'KMG-AUTH-403';
  end if;

  update public.association_levee_calls
  set status = status_value
  where id = call_uuid;
end;
$$;

grant execute on function public.update_association_levee_call_status(uuid, public.association_levee_call_status) to authenticated;

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

  return query
  select created_levee.id, created_levee.pool_size, created_levee.per_share_amount_cents;
end;
$$;

grant execute on function public.create_levee(text, text, date, bigint, date) to authenticated;

