-- Ticket #25: pilot program onboarding, migration support, and feedback loop.
create table if not exists public.pilot_associations (
  id uuid primary key default extensions.gen_random_uuid(),
  association_id uuid not null unique references public.associations(id) on delete cascade,
  status text not null default 'onboarding' check (status in ('onboarding', 'active_pilot', 'iteration', 'completed', 'paused')),
  guided_setup_status text not null default 'not_started' check (guided_setup_status in ('not_started', 'in_progress', 'completed')),
  data_migration_status text not null default 'not_started' check (data_migration_status in ('not_started', 'in_progress', 'completed', 'blocked')),
  notes text,
  setup_completed_at timestamptz,
  data_migration_completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_feedback (
  id uuid primary key default extensions.gen_random_uuid(),
  pilot_association_id uuid not null references public.pilot_associations(id) on delete cascade,
  category text not null check (category in ('onboarding', 'data_migration', 'member_flow', 'payments', 'general')),
  rating integer check (rating between 1 and 5),
  feedback text not null,
  iteration_notes text,
  reviewed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilot_associations_status_idx on public.pilot_associations(status);
create index if not exists pilot_associations_association_id_idx on public.pilot_associations(association_id);
create index if not exists pilot_feedback_pilot_association_id_idx on public.pilot_feedback(pilot_association_id);
create index if not exists pilot_feedback_reviewed_at_idx on public.pilot_feedback(reviewed_at);

drop trigger if exists set_pilot_associations_updated_at on public.pilot_associations;
create trigger set_pilot_associations_updated_at
before update on public.pilot_associations
for each row
execute function public.set_updated_at();

drop trigger if exists set_pilot_feedback_updated_at on public.pilot_feedback;
create trigger set_pilot_feedback_updated_at
before update on public.pilot_feedback
for each row
execute function public.set_updated_at();

alter table public.pilot_associations enable row level security;
alter table public.pilot_feedback enable row level security;

drop policy if exists "Platform admins can manage pilot associations" on public.pilot_associations;
create policy "Platform admins can manage pilot associations"
on public.pilot_associations
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can read own pilot status" on public.pilot_associations;
create policy "Association admins can read own pilot status"
on public.pilot_associations
for select
to authenticated
using (public.is_association_admin(association_id));

drop policy if exists "Platform admins can manage pilot feedback" on public.pilot_feedback;
create policy "Platform admins can manage pilot feedback"
on public.pilot_feedback
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can create own pilot feedback" on public.pilot_feedback;
create policy "Association admins can create own pilot feedback"
on public.pilot_feedback
for insert
to authenticated
with check (
  exists (
    select 1
    from public.pilot_associations pilot
    where pilot.id = pilot_association_id
      and public.is_association_admin(pilot.association_id)
  )
);

drop policy if exists "Association admins can read own pilot feedback" on public.pilot_feedback;
create policy "Association admins can read own pilot feedback"
on public.pilot_feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.pilot_associations pilot
    where pilot.id = pilot_association_id
      and public.is_association_admin(pilot.association_id)
  )
);
