-- Ticket #5: Phase 1 database schema, indexes, triggers, helper functions, and RLS policies.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'association_status') then
    create type public.association_status as enum ('pending_review', 'active', 'declined', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'association_member_role') then
    create type public.association_member_role as enum ('association_admin', 'member');
  end if;

  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum ('pending', 'active', 'declined', 'suspended', 'needs_more_evidence');
  end if;

  if not exists (select 1 from pg_type where typname = 'evidence_type') then
    create type public.evidence_type as enum ('government_id', 'immigration_proof');
  end if;

  if not exists (select 1 from pg_type where typname = 'evidence_status') then
    create type public.evidence_status as enum ('pending', 'uploaded', 'destroyed');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text,
  last_name text,
  phone text,
  date_of_arrival_canada date,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ticket #5 expects an id column on user_roles. Ticket #4 created user_id as the primary key,
-- so this migration evolves the table without dropping existing data.
alter table public.user_roles
add column if not exists id uuid default extensions.gen_random_uuid();

update public.user_roles
set id = extensions.gen_random_uuid()
where id is null;

alter table public.user_roles
alter column id set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'user_roles'
      and constraint_name = 'user_roles_pkey'
  ) then
    alter table public.user_roles drop constraint user_roles_pkey;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'user_roles'
      and constraint_name = 'user_roles_pkey'
  ) then
    alter table public.user_roles add constraint user_roles_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'user_roles'
      and constraint_name = 'user_roles_user_id_key'
  ) then
    alter table public.user_roles add constraint user_roles_user_id_key unique (user_id);
  end if;
end $$;

create table if not exists public.associations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  city text not null,
  contact_email text,
  status public.association_status not null default 'pending_review',
  allow_member_referrals boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.association_members (
  id uuid primary key default extensions.gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.association_member_role not null default 'member',
  status public.membership_status not null default 'pending',
  referred_by uuid references public.association_members(id) on delete set null,
  decline_reason_html text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint association_members_association_user_unique unique (association_id, user_id)
);

create table if not exists public.referral_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  token text not null unique,
  association_id uuid not null references public.associations(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  used_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referral_tokens_used_consistency check (
    (used_by is null and used_at is null) or (used_by is not null and used_at is not null)
  )
);

create table if not exists public.evidence_uploads (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.association_members(id) on delete cascade,
  evidence_type public.evidence_type not null,
  storage_path text not null,
  status public.evidence_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sin_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null unique references public.association_members(id) on delete cascade,
  encrypted_sin bytea not null,
  iv bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists user_roles_role_idx on public.user_roles(role);
create index if not exists users_email_idx on public.users(email);
create index if not exists associations_status_idx on public.associations(status);
create index if not exists associations_city_idx on public.associations(city);
create index if not exists associations_created_by_idx on public.associations(created_by);
create index if not exists association_members_association_id_idx on public.association_members(association_id);
create index if not exists association_members_user_id_idx on public.association_members(user_id);
create index if not exists association_members_status_idx on public.association_members(status);
create index if not exists association_members_referred_by_idx on public.association_members(referred_by);
create index if not exists association_members_reviewed_by_idx on public.association_members(reviewed_by);
create index if not exists referral_tokens_token_idx on public.referral_tokens(token);
create index if not exists referral_tokens_association_id_idx on public.referral_tokens(association_id);
create index if not exists referral_tokens_created_by_idx on public.referral_tokens(created_by);
create index if not exists referral_tokens_used_by_idx on public.referral_tokens(used_by);
create index if not exists referral_tokens_expires_at_idx on public.referral_tokens(expires_at);
create index if not exists evidence_uploads_membership_id_idx on public.evidence_uploads(membership_id);
create index if not exists evidence_uploads_status_idx on public.evidence_uploads(status);
create index if not exists sin_tokens_membership_id_idx on public.sin_tokens(membership_id);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_associations_updated_at on public.associations;
create trigger set_associations_updated_at
before update on public.associations
for each row
execute function public.set_updated_at();

drop trigger if exists set_association_members_updated_at on public.association_members;
create trigger set_association_members_updated_at
before update on public.association_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_evidence_uploads_updated_at on public.evidence_uploads;
create trigger set_evidence_uploads_updated_at
before update on public.evidence_uploads
for each row
execute function public.set_updated_at();

drop trigger if exists set_sin_tokens_updated_at on public.sin_tokens;
create trigger set_sin_tokens_updated_at
before update on public.sin_tokens
for each row
execute function public.set_updated_at();

create or replace function public.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, first_name, last_name, phone, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en')
  )
  on conflict (id) do update
  set email = excluded.email,
      first_name = coalesce(public.users.first_name, excluded.first_name),
      last_name = coalesce(public.users.last_name, excluded.last_name),
      phone = coalesce(public.users.phone, excluded.phone),
      locale = excluded.locale;

  return new;
end;
$$;

drop trigger if exists sync_auth_user_profile on auth.users;
create trigger sync_auth_user_profile
after insert or update on auth.users
for each row
execute function public.sync_auth_user();

create or replace function public.is_platform_admin()
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
      and role = 'platform_admin'
  );
$$;

create or replace function public.is_association_member(association_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.association_members
    where association_id = association_uuid
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_association_admin(association_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.association_members
    where association_id = association_uuid
      and user_id = auth.uid()
      and role = 'association_admin'
      and status = 'active'
  );
$$;

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

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_association_member(uuid) to authenticated;
grant execute on function public.is_association_admin(uuid) to authenticated;
grant execute on function public.get_current_user_role() to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;

alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.associations enable row level security;
alter table public.association_members enable row level security;
alter table public.referral_tokens enable row level security;
alter table public.evidence_uploads enable row level security;
alter table public.sin_tokens enable row level security;

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
on public.users
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Platform admins can manage users" on public.users;
create policy "Platform admins can manage users"
on public.users
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

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
using (public.is_platform_admin());

drop policy if exists "Platform admins can manage roles" on public.user_roles;
create policy "Platform admins can manage roles"
on public.user_roles
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Authenticated users can read active associations" on public.associations;
create policy "Authenticated users can read active associations"
on public.associations
for select
to authenticated
using (status = 'active');

drop policy if exists "Association admins can read own associations" on public.associations;
create policy "Association admins can read own associations"
on public.associations
for select
to authenticated
using (public.is_association_admin(id));

drop policy if exists "Association admins can update own associations" on public.associations;
create policy "Association admins can update own associations"
on public.associations
for update
to authenticated
using (public.is_association_admin(id))
with check (public.is_association_admin(id));

drop policy if exists "Authenticated users can create associations" on public.associations;
create policy "Authenticated users can create associations"
on public.associations
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Platform admins can manage associations" on public.associations;
create policy "Platform admins can manage associations"
on public.associations
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Users can read own memberships" on public.association_members;
create policy "Users can read own memberships"
on public.association_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Association admins can manage own memberships" on public.association_members;
create policy "Association admins can manage own memberships"
on public.association_members
for all
to authenticated
using (public.is_association_admin(association_id))
with check (public.is_association_admin(association_id));

drop policy if exists "Platform admins can manage memberships" on public.association_members;
create policy "Platform admins can manage memberships"
on public.association_members
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can manage referral tokens" on public.referral_tokens;
create policy "Association admins can manage referral tokens"
on public.referral_tokens
for all
to authenticated
using (public.is_association_admin(association_id))
with check (public.is_association_admin(association_id) and created_by = auth.uid());

drop policy if exists "Members can read created or used referral tokens" on public.referral_tokens;
create policy "Members can read created or used referral tokens"
on public.referral_tokens
for select
to authenticated
using (created_by = auth.uid() or used_by = auth.uid());

drop policy if exists "Platform admins can manage referral tokens" on public.referral_tokens;
create policy "Platform admins can manage referral tokens"
on public.referral_tokens
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Users can read own evidence uploads" on public.evidence_uploads;
create policy "Users can read own evidence uploads"
on public.evidence_uploads
for select
to authenticated
using (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = membership_id
      and memberships.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own evidence uploads" on public.evidence_uploads;
create policy "Users can create own evidence uploads"
on public.evidence_uploads
for insert
to authenticated
with check (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = membership_id
      and memberships.user_id = auth.uid()
  )
);

drop policy if exists "Association admins can manage member evidence" on public.evidence_uploads;
create policy "Association admins can manage member evidence"
on public.evidence_uploads
for all
to authenticated
using (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = membership_id
      and public.is_association_admin(memberships.association_id)
  )
)
with check (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = membership_id
      and public.is_association_admin(memberships.association_id)
  )
);

drop policy if exists "Platform admins can manage evidence uploads" on public.evidence_uploads;
create policy "Platform admins can manage evidence uploads"
on public.evidence_uploads
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can manage member SIN tokens" on public.sin_tokens;
create policy "Association admins can manage member SIN tokens"
on public.sin_tokens
for all
to authenticated
using (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = membership_id
      and public.is_association_admin(memberships.association_id)
  )
)
with check (
  exists (
    select 1
    from public.association_members memberships
    where memberships.id = membership_id
      and public.is_association_admin(memberships.association_id)
  )
);

drop policy if exists "Platform admins can manage SIN tokens" on public.sin_tokens;
create policy "Platform admins can manage SIN tokens"
on public.sin_tokens
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());