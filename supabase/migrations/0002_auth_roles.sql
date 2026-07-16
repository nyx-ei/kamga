-- Ticket #4: platform role model and RLS-backed RBAC foundation.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('platform_admin', 'association_admin', 'member');
  end if;
end $$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_updated_at();

create or replace function public.get_current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_roles
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
$$;

grant execute on function public.get_current_user_role() to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;

drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Users can read their own role"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Platform admins can read all roles" on public.user_roles;
create policy "Platform admins can read all roles"
on public.user_roles
for select
to authenticated
using (public.has_role('platform_admin'));

drop policy if exists "Platform admins can manage roles" on public.user_roles;
create policy "Platform admins can manage roles"
on public.user_roles
for all
to authenticated
using (public.has_role('platform_admin'))
with check (public.has_role('platform_admin'));
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_user_role on auth.users;
create trigger create_default_user_role
after insert on auth.users
for each row
execute function public.handle_new_user_role();