-- Ticket #15: levee initiation, pool snapshot, and per-share calculation.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'levee_status') then
    create type public.levee_status as enum ('active', 'closed', 'cancelled');
  end if;
end
$$;

create table if not exists public.levees (
  id uuid primary key default gen_random_uuid(),
  deceased_full_name text not null check (char_length(trim(deceased_full_name)) between 2 and 180),
  deceased_city text null check (deceased_city is null or char_length(trim(deceased_city)) <= 120),
  deceased_date_of_death date null,
  target_amount_cents bigint not null check (target_amount_cents > 0),
  deadline date not null,
  pool_size integer not null check (pool_size > 0),
  per_share_amount_cents numeric(14, 2) not null check (per_share_amount_cents > 0),
  status public.levee_status not null default 'active',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists levees_status_idx on public.levees(status);
create index if not exists levees_deadline_idx on public.levees(deadline);
create index if not exists levees_created_by_idx on public.levees(created_by);

drop trigger if exists set_levees_updated_at on public.levees;
create trigger set_levees_updated_at
before update on public.levees
for each row
execute function public.set_updated_at();

alter table public.levees enable row level security;

drop policy if exists "Platform admins can manage levees" on public.levees;
create policy "Platform admins can manage levees"
on public.levees
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.current_total_share_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(distinct memberships.id)::integer + count(dependents.id)::integer, 0)
  from public.association_members memberships
  left join public.member_dependents dependents on dependents.membership_id = memberships.id
  where memberships.status = 'active';
$$;

grant execute on function public.current_total_share_count() to authenticated;

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

  return query
  select created_levee.id, created_levee.pool_size, created_levee.per_share_amount_cents;
end;
$$;

grant execute on function public.create_levee(text, text, date, bigint, date) to authenticated;
