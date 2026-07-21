-- Layer 1 recruit leads: capture uncovered directory demand without fabricating association records.
create table if not exists public.association_recruit_leads (
  id uuid primary key default gen_random_uuid(),
  search_query text not null default '',
  city text,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  association_name text,
  requester_name text,
  requester_email text,
  message text,
  requester_ip_hash text,
  reply_channel_hash text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  contacted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint association_recruit_leads_contacted_at_status_check check (status <> 'contacted' or contacted_at is not null),
  constraint association_recruit_leads_closed_at_status_check check (status <> 'closed' or closed_at is not null)
);

create index if not exists association_recruit_leads_status_created_at_idx on public.association_recruit_leads(status, created_at desc);
create index if not exists association_recruit_leads_requester_ip_hash_created_at_idx on public.association_recruit_leads(requester_ip_hash, created_at desc) where requester_ip_hash is not null;
create index if not exists association_recruit_leads_reply_channel_hash_created_at_idx on public.association_recruit_leads(reply_channel_hash, created_at desc) where reply_channel_hash is not null;

alter table public.association_recruit_leads enable row level security;

drop policy if exists "Platform admins can manage recruit leads" on public.association_recruit_leads;
create policy "Platform admins can manage recruit leads"
on public.association_recruit_leads
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.touch_association_recruit_leads_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_association_recruit_leads_updated_at on public.association_recruit_leads;
create trigger touch_association_recruit_leads_updated_at
before update on public.association_recruit_leads
for each row execute function public.touch_association_recruit_leads_updated_at();

create or replace function public.submit_association_recruit_lead(
  search_query_value text,
  city_value text,
  locale_value text,
  association_name_value text,
  requester_name_value text,
  requester_email_value text,
  message_value text,
  requester_ip_hash_value text,
  reply_channel_hash_value text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_uuid uuid;
  recent_count integer;
begin
  if coalesce(locale_value, '') not in ('en', 'fr') then
    raise exception 'KMG-RC-001';
  end if;

  if length(trim(coalesce(search_query_value, ''))) = 0 and length(trim(coalesce(association_name_value, ''))) = 0 then
    raise exception 'KMG-RC-001';
  end if;

  if requester_email_value is not null and requester_email_value !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'KMG-RC-001';
  end if;

  if requester_ip_hash_value is not null then
    select count(*) into recent_count
    from public.association_recruit_leads
    where requester_ip_hash = requester_ip_hash_value
      and created_at > now() - interval '1 hour';

    if recent_count >= 5 then
      raise exception 'KMG-RC-429';
    end if;
  end if;

  if reply_channel_hash_value is not null then
    select count(*) into recent_count
    from public.association_recruit_leads
    where reply_channel_hash = reply_channel_hash_value
      and created_at > now() - interval '1 hour';

    if recent_count >= 5 then
      raise exception 'KMG-RC-429';
    end if;
  end if;

  insert into public.association_recruit_leads (
    search_query,
    city,
    locale,
    association_name,
    requester_name,
    requester_email,
    message,
    requester_ip_hash,
    reply_channel_hash
  ) values (
    left(trim(coalesce(search_query_value, '')), 120),
    nullif(left(trim(coalesce(city_value, '')), 120), ''),
    locale_value,
    nullif(left(trim(coalesce(association_name_value, '')), 180), ''),
    nullif(left(trim(coalesce(requester_name_value, '')), 140), ''),
    nullif(left(trim(coalesce(requester_email_value, '')), 254), ''),
    nullif(left(trim(coalesce(message_value, '')), 1200), ''),
    requester_ip_hash_value,
    reply_channel_hash_value
  ) returning id into lead_uuid;

  return lead_uuid;
end;
$$;

grant execute on function public.submit_association_recruit_lead(text, text, text, text, text, text, text, text, text) to anon, authenticated;

select public.attach_audit_trigger('association_recruit_leads')
where exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and pg_proc.proname = 'attach_audit_trigger'
);