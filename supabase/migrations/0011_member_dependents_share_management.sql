-- Ticket #14: relatives/dependents and share count management.
create table if not exists public.member_dependents (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.association_members(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 160),
  relationship text not null check (char_length(trim(relationship)) between 2 and 80),
  external_id text null check (external_id is null or char_length(trim(external_id)) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_dependents_membership_id_idx on public.member_dependents(membership_id);

drop trigger if exists set_member_dependents_updated_at on public.member_dependents;
create trigger set_member_dependents_updated_at
before update on public.member_dependents
for each row
execute function public.set_updated_at();

alter table public.member_dependents enable row level security;

drop policy if exists "Users can read own dependents" on public.member_dependents;
create policy "Users can read own dependents"
on public.member_dependents
for select
to authenticated
using (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = member_dependents.membership_id
      and memberships.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage active own dependents" on public.member_dependents;
create policy "Users can manage active own dependents"
on public.member_dependents
for all
to authenticated
using (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = member_dependents.membership_id
      and memberships.user_id = auth.uid()
      and memberships.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = member_dependents.membership_id
      and memberships.user_id = auth.uid()
      and memberships.status = 'active'
  )
);

drop policy if exists "Association admins can read member dependents" on public.member_dependents;
create policy "Association admins can read member dependents"
on public.member_dependents
for select
to authenticated
using (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = member_dependents.membership_id
      and public.is_association_admin(memberships.association_id)
  )
);

drop policy if exists "Platform admins can read member dependents" on public.member_dependents;
create policy "Platform admins can read member dependents"
on public.member_dependents
for select
to authenticated
using (public.is_platform_admin());

create or replace view public.association_share_totals
with (security_invoker = true)
as
select
  memberships.association_id,
  count(distinct memberships.id)::integer + count(dependents.id)::integer as total_shares
from public.association_members memberships
left join public.member_dependents dependents on dependents.membership_id = memberships.id
where memberships.status = 'active'
group by memberships.association_id;

grant select on public.association_share_totals to authenticated;
