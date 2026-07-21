-- Layer 1 lookup compliance: public directory, privacy-safe contact routing, and association metadata.
create extension if not exists pg_trgm with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'association_verification_status' and typnamespace = 'public'::regnamespace) then
    create type public.association_verification_status as enum ('unverified', 'verified', 'needs_review');
  end if;

  if not exists (select 1 from pg_type where typname = 'association_claim_status' and typnamespace = 'public'::regnamespace) then
    create type public.association_claim_status as enum ('unclaimed', 'claimed', 'claim_pending', 'claim_locked');
  end if;

  if not exists (select 1 from pg_type where typname = 'association_source' and typnamespace = 'public'::regnamespace) then
    create type public.association_source as enum ('admin_entered', 'csv_import', 'self_registered');
  end if;

  if not exists (select 1 from pg_type where typname = 'association_public_precision' and typnamespace = 'public'::regnamespace) then
    create type public.association_public_precision as enum ('neighbourhood', 'exact');
  end if;

  if not exists (select 1 from pg_type where typname = 'association_geocode_status' and typnamespace = 'public'::regnamespace) then
    create type public.association_geocode_status as enum ('pending', 'geocoded', 'failed', 'needs_review');
  end if;

  if not exists (select 1 from pg_type where typname = 'association_primary_language' and typnamespace = 'public'::regnamespace) then
    create type public.association_primary_language as enum ('fr', 'en', 'fr_en');
  end if;

  if not exists (select 1 from pg_type where typname = 'connect_request_status' and typnamespace = 'public'::regnamespace) then
    create type public.connect_request_status as enum ('queued', 'routed', 'brokered', 'closed');
  end if;
end $$;

alter table public.associations
add column if not exists official_name text,
add column if not exists common_name text,
add column if not exists aliases text[] not null default '{}',
add column if not exists street_address text,
add column if not exists postal_code text,
add column if not exists province text not null default 'QC',
add column if not exists latitude double precision,
add column if not exists longitude double precision,
add column if not exists geocode_status public.association_geocode_status not null default 'pending',
add column if not exists public_precision public.association_public_precision not null default 'neighbourhood',
add column if not exists primary_language public.association_primary_language not null default 'fr',
add column if not exists registry_number text,
add column if not exists registry_type text check (registry_type is null or registry_type in ('neq', 'federal')),
add column if not exists verification_status public.association_verification_status not null default 'unverified',
add column if not exists claim_status public.association_claim_status not null default 'unclaimed',
add column if not exists source public.association_source not null default 'admin_entered',
add column if not exists public_contact_email boolean not null default false,
add column if not exists public_contact_phone boolean not null default false,
add column if not exists contact_notification_opt_in_status text not null default 'pending' check (contact_notification_opt_in_status in ('pending', 'confirmed', 'withdrawn')),
add column if not exists contact_notification_opted_in_at timestamptz,
add column if not exists contact_notification_withdrawn_at timestamptz,
add column if not exists contact_notification_confirmation_sent_at timestamptz,
add column if not exists contact_notification_confirmation_send_count integer not null default 0 check (contact_notification_confirmation_send_count >= 0),
add column if not exists connect_request_count integer not null default 0 check (connect_request_count >= 0);

update public.associations
set official_name = coalesce(official_name, name),
    common_name = coalesce(common_name, name),
    province = coalesce(nullif(province, ''), 'QC'),
    source = case
      when created_by is not null and source = 'admin_entered' then 'self_registered'::public.association_source
      else source
    end,
    claim_status = case
      when created_by is not null and claim_status = 'unclaimed' then 'claimed'::public.association_claim_status
      else claim_status
    end
where official_name is null
   or common_name is null
   or province is null
   or (created_by is not null and (source = 'admin_entered' or claim_status = 'unclaimed'));

alter table public.associations
alter column official_name set not null;

create index if not exists associations_official_name_trgm_idx on public.associations using gin (official_name extensions.gin_trgm_ops);
create index if not exists associations_common_name_trgm_idx on public.associations using gin (common_name extensions.gin_trgm_ops);
create index if not exists associations_registry_number_idx on public.associations(registry_number) where registry_number is not null;
create index if not exists associations_lookup_location_idx on public.associations(status, geocode_status, latitude, longitude);
create index if not exists associations_verification_status_idx on public.associations(verification_status);
create index if not exists associations_claim_status_idx on public.associations(claim_status);
create index if not exists associations_source_idx on public.associations(source);

create table if not exists public.association_connect_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  requester_name text not null,
  requester_email text,
  requester_phone text,
  message text not null,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  status public.connect_request_status not null default 'queued',
  routed_to_claimed_record boolean not null default false,
  requester_ip_hash text,
  reply_channel_hash text,
  created_at timestamptz not null default now(),
  brokered_at timestamptz,
  closed_at timestamptz,
  constraint association_connect_requests_reply_channel_check check (requester_email is not null or requester_phone is not null)
);

create index if not exists association_connect_requests_association_id_idx on public.association_connect_requests(association_id);
create index if not exists association_connect_requests_status_idx on public.association_connect_requests(status);
create index if not exists association_connect_requests_created_at_idx on public.association_connect_requests(created_at desc);
create index if not exists association_connect_requests_rate_ip_idx on public.association_connect_requests(requester_ip_hash, created_at desc) where requester_ip_hash is not null;
create index if not exists association_connect_requests_rate_reply_idx on public.association_connect_requests(reply_channel_hash, created_at desc) where reply_channel_hash is not null;

alter table public.association_connect_requests enable row level security;

drop policy if exists "Platform admins can manage connect requests" on public.association_connect_requests;
create policy "Platform admins can manage connect requests"
on public.association_connect_requests
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Association admins can read own connect requests" on public.association_connect_requests;
create policy "Association admins can read own connect requests"
on public.association_connect_requests
for select
to authenticated
using (public.is_association_admin(association_id));

drop trigger if exists set_association_connect_requests_updated_at on public.association_connect_requests;

create or replace function public.increment_connect_request_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.associations
  set connect_request_count = connect_request_count + 1
  where id = new.association_id;

  return new;
end;
$$;

drop trigger if exists increment_association_connect_request_count on public.association_connect_requests;
create trigger increment_association_connect_request_count
after insert on public.association_connect_requests
for each row
execute function public.increment_connect_request_count();

create or replace view public.public_association_directory
with (security_invoker = true)
as
select
  id,
  coalesce(nullif(common_name, ''), official_name, name) as display_name,
  city,
  province,
  description,
  primary_language,
  verification_status,
  claim_status,
  public_precision,
  case when public_precision = 'exact' then street_address else null end as public_street_address,
  latitude,
  longitude,
  geocode_status,
  updated_at
from public.associations
where status = 'active'
  and (geocode_status in ('pending', 'geocoded') or latitude is null or longitude is null);

grant select on public.public_association_directory to anon, authenticated;

create or replace function public.submit_association_connect_request(
  association_uuid uuid,
  requester_name_value text,
  requester_email_value text,
  requester_phone_value text,
  message_value text,
  locale_value text,
  requester_ip_hash_value text default null,
  reply_channel_hash_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  association_row public.associations;
  recent_ip_count integer;
  recent_reply_count integer;
  connect_request_id uuid;
begin
  select *
  into association_row
  from public.associations
  where id = association_uuid
    and status = 'active';

  if association_row.id is null then
    raise exception 'KMG-RC-404';
  end if;

  if length(trim(requester_name_value)) < 2
    or length(trim(message_value)) < 10
    or (nullif(trim(coalesce(requester_email_value, '')), '') is null and nullif(trim(coalesce(requester_phone_value, '')), '') is null)
  then
    raise exception 'KMG-RC-001';
  end if;

  if requester_ip_hash_value is not null then
    select count(*)
    into recent_ip_count
    from public.association_connect_requests
    where requester_ip_hash = requester_ip_hash_value
      and created_at >= now() - interval '1 hour';

    if recent_ip_count >= 5 then
      raise exception 'KMG-RC-429';
    end if;
  end if;

  if reply_channel_hash_value is not null then
    select count(*)
    into recent_reply_count
    from public.association_connect_requests
    where reply_channel_hash = reply_channel_hash_value
      and created_at >= now() - interval '1 hour';

    if recent_reply_count >= 5 then
      raise exception 'KMG-RC-429';
    end if;
  end if;

  insert into public.association_connect_requests (
    association_id,
    requester_name,
    requester_email,
    requester_phone,
    message,
    locale,
    status,
    routed_to_claimed_record,
    requester_ip_hash,
    reply_channel_hash
  )
  values (
    association_uuid,
    trim(requester_name_value),
    nullif(trim(coalesce(requester_email_value, '')), ''),
    nullif(trim(coalesce(requester_phone_value, '')), ''),
    trim(message_value),
    case when locale_value in ('en', 'fr') then locale_value else 'en' end,
    case when association_row.claim_status = 'claimed' then 'routed'::public.connect_request_status else 'queued'::public.connect_request_status end,
    association_row.claim_status = 'claimed',
    requester_ip_hash_value,
    reply_channel_hash_value
  )
  returning id into connect_request_id;

  return connect_request_id;
end;
$$;

grant execute on function public.submit_association_connect_request(uuid, text, text, text, text, text, text, text) to anon, authenticated;

select public.attach_audit_trigger('association_connect_requests')
where exists (select 1 from pg_proc where proname = 'attach_audit_trigger');
