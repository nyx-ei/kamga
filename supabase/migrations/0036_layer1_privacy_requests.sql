-- Layer 1 privacy compliance: association contact erasure and delisting requests.

create table if not exists public.association_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  request_type text not null check (request_type in ('remove_contact', 'delist_record')),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint association_privacy_requests_terminal_review_check check (status = 'pending' or reviewed_at is not null)
);

create unique index if not exists association_privacy_requests_one_pending_per_type_idx
on public.association_privacy_requests(association_id, request_type)
where status = 'pending';

create index if not exists association_privacy_requests_status_created_at_idx
on public.association_privacy_requests(status, created_at desc);

create index if not exists association_privacy_requests_requester_user_id_idx
on public.association_privacy_requests(requester_user_id);

alter table public.association_privacy_requests enable row level security;

drop policy if exists "Association admins can read their privacy requests" on public.association_privacy_requests;
create policy "Association admins can read their privacy requests"
on public.association_privacy_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.association_members membership
    where membership.association_id = association_privacy_requests.association_id
      and membership.user_id = auth.uid()
      and membership.role = 'association_admin'
      and membership.status = 'active'
  )
);

drop policy if exists "Platform admins can manage privacy requests" on public.association_privacy_requests;
create policy "Platform admins can manage privacy requests"
on public.association_privacy_requests
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.touch_association_privacy_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_association_privacy_requests_updated_at on public.association_privacy_requests;
create trigger touch_association_privacy_requests_updated_at
before update on public.association_privacy_requests
for each row execute function public.touch_association_privacy_requests_updated_at();

create or replace function public.submit_association_privacy_request(
  association_uuid uuid,
  request_type_value text,
  reason_value text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_reason text := nullif(trim(coalesce(reason_value, '')), '');
  request_uuid uuid;
begin
  if auth.uid() is null then
    return 'KMG-AUTH-401';
  end if;

  if request_type_value not in ('remove_contact', 'delist_record') then
    return 'KMG-PC-001';
  end if;

  if not exists (
    select 1
    from public.association_members membership
    where membership.association_id = association_uuid
      and membership.user_id = auth.uid()
      and membership.role = 'association_admin'
      and membership.status = 'active'
  ) then
    return 'KMG-AUTH-403';
  end if;

  insert into public.association_privacy_requests (
    association_id,
    requester_user_id,
    request_type,
    reason
  )
  values (
    association_uuid,
    auth.uid(),
    request_type_value,
    normalized_reason
  )
  on conflict (association_id, request_type) where status = 'pending'
  do nothing
  returning id into request_uuid;

  if request_uuid is null then
    return 'KMG-PC-409';
  end if;

  return 'ok';
end;
$$;

create or replace function public.resolve_association_privacy_request(
  privacy_request_uuid uuid,
  decision_value text,
  admin_note_value text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.association_privacy_requests%rowtype;
  normalized_note text := nullif(trim(coalesce(admin_note_value, '')), '');
begin
  if auth.uid() is null then
    return 'KMG-AUTH-401';
  end if;

  if not public.is_platform_admin() then
    return 'KMG-AUTH-403';
  end if;

  if decision_value not in ('completed', 'rejected') then
    return 'KMG-PC-001';
  end if;

  select * into request_row
  from public.association_privacy_requests
  where id = privacy_request_uuid
  for update;

  if request_row.id is null then
    return 'KMG-PC-404';
  end if;

  if request_row.status <> 'pending' then
    return 'KMG-PC-409';
  end if;

  if decision_value = 'completed' and request_row.request_type = 'remove_contact' then
    update public.associations
    set
      contact_email = null,
      public_contact_email = false,
      public_contact_phone = false,
      contact_notification_opt_in_status = 'withdrawn',
      contact_notification_opted_in_at = null,
      contact_notification_withdrawn_at = now(),
      contact_notification_confirmation_sent_at = null,
      contact_notification_confirmation_next_send_at = null,
      updated_at = now()
    where id = request_row.association_id;
  end if;

  if decision_value = 'completed' and request_row.request_type = 'delist_record' then
    update public.associations
    set
      status = 'suspended',
      contact_email = null,
      public_contact_email = false,
      public_contact_phone = false,
      contact_notification_opt_in_status = 'withdrawn',
      contact_notification_withdrawn_at = now(),
      updated_at = now()
    where id = request_row.association_id;
  end if;

  update public.association_privacy_requests
  set
    admin_note = normalized_note,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    status = decision_value
  where id = privacy_request_uuid;

  return 'ok';
end;
$$;

grant execute on function public.submit_association_privacy_request(uuid, text, text) to authenticated;
grant execute on function public.resolve_association_privacy_request(uuid, text, text) to authenticated;

select public.attach_audit_trigger('association_privacy_requests')
where exists (select 1 from pg_proc where proname = 'attach_audit_trigger');