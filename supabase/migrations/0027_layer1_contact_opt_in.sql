-- Layer 1 contact notification double opt-in.
alter table public.associations
add column if not exists contact_notification_confirmation_next_send_at timestamptz;

create table if not exists public.association_contact_opt_in_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  purpose text not null default 'confirm' check (purpose in ('confirm', 'withdraw')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists association_contact_opt_in_tokens_association_id_idx on public.association_contact_opt_in_tokens(association_id);
create index if not exists association_contact_opt_in_tokens_email_idx on public.association_contact_opt_in_tokens(lower(email));
create index if not exists association_contact_opt_in_tokens_pending_idx on public.association_contact_opt_in_tokens(expires_at) where consumed_at is null;

alter table public.association_contact_opt_in_tokens enable row level security;

drop policy if exists "Platform admins can manage contact opt-in tokens" on public.association_contact_opt_in_tokens;
create policy "Platform admins can manage contact opt-in tokens"
on public.association_contact_opt_in_tokens
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());