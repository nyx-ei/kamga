-- Layer 1 claim verification routing: persist claim attempts and provide admin resolution.
create table if not exists public.association_claim_requests (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  claimant_user_id uuid not null references public.users(id) on delete cascade,
  registry_number_attempted text not null,
  contact_email_attempted text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'locked')),
  failure_reason text check (failure_reason in ('missing_private_data', 'mismatch', 'competing_claim') or failure_reason is null),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists association_claim_requests_one_pending_per_association_idx
on public.association_claim_requests(association_id)
where status = 'pending';

create index if not exists association_claim_requests_association_id_idx on public.association_claim_requests(association_id);
create index if not exists association_claim_requests_claimant_user_id_idx on public.association_claim_requests(claimant_user_id);
create index if not exists association_claim_requests_status_created_at_idx on public.association_claim_requests(status, created_at desc);

alter table public.association_claim_requests enable row level security;

drop policy if exists "Platform admins can manage association claim requests" on public.association_claim_requests;
create policy "Platform admins can manage association claim requests"
on public.association_claim_requests
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Claimants can read their own association claim requests" on public.association_claim_requests;
create policy "Claimants can read their own association claim requests"
on public.association_claim_requests
for select
to authenticated
using (claimant_user_id = auth.uid());

create or replace function public.touch_association_claim_requests_updated_at()
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

drop trigger if exists touch_association_claim_requests_updated_at on public.association_claim_requests;
create trigger touch_association_claim_requests_updated_at
before update on public.association_claim_requests
for each row execute function public.touch_association_claim_requests_updated_at();

drop function if exists public.claim_association(uuid, text, text);

create or replace function public.claim_association(
  association_uuid uuid,
  registry_number_value text,
  contact_email_value text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  association_row public.associations;
  normalized_registry text := nullif(trim(registry_number_value), '');
  normalized_email text := lower(nullif(trim(contact_email_value), ''));
  existing_pending public.association_claim_requests;
  request_uuid uuid;
begin
  if auth.uid() is null then
    return 'KMG-AUTH-401';
  end if;

  select *
  into association_row
  from public.associations
  where id = association_uuid
  for update;

  if not found or association_row.status <> 'active' then
    return 'KMG-CL-404';
  end if;

  if normalized_registry is null or normalized_email is null then
    return 'KMG-CL-001';
  end if;

  if association_row.claim_status = 'claimed' or association_row.claim_status = 'claim_locked' then
    return 'KMG-CL-409';
  end if;

  select *
  into existing_pending
  from public.association_claim_requests
  where association_id = association_uuid
    and status = 'pending'
  order by created_at asc
  limit 1
  for update;

  if found and existing_pending.claimant_user_id <> auth.uid() then
    insert into public.association_claim_requests (
      association_id,
      claimant_user_id,
      registry_number_attempted,
      contact_email_attempted,
      status,
      failure_reason
    ) values (
      association_uuid,
      auth.uid(),
      normalized_registry,
      normalized_email,
      'locked',
      'competing_claim'
    );

    update public.associations
    set claim_status = 'claim_locked'
    where id = association_uuid;

    return 'KMG-CL-409';
  end if;

  if found and existing_pending.claimant_user_id = auth.uid() then
    return 'KMG-CL-409';
  end if;

  if association_row.registry_number is not null
     and association_row.contact_email is not null
     and lower(association_row.registry_number) = lower(normalized_registry)
     and lower(association_row.contact_email) = normalized_email then
    insert into public.association_claim_requests (
      association_id,
      claimant_user_id,
      registry_number_attempted,
      contact_email_attempted,
      status,
      reviewed_by,
      reviewed_at
    ) values (
      association_uuid,
      auth.uid(),
      normalized_registry,
      normalized_email,
      'approved',
      auth.uid(),
      now()
    );

    update public.associations
    set claim_status = 'claimed',
        created_by = auth.uid(),
        contact_notification_opt_in_status = case
          when contact_notification_opt_in_status = 'withdrawn' then 'pending'
          else contact_notification_opt_in_status
        end
    where id = association_uuid;

    insert into public.association_members (association_id, user_id, role, status, referred_by, reviewed_by, reviewed_at)
    values (association_uuid, auth.uid(), 'association_admin', 'active', null, auth.uid(), now())
    on conflict (association_id, user_id) do update
    set role = 'association_admin',
        status = 'active',
        reviewed_by = auth.uid(),
        reviewed_at = now();

    return 'ok';
  end if;

  insert into public.association_claim_requests (
    association_id,
    claimant_user_id,
    registry_number_attempted,
    contact_email_attempted,
    status,
    failure_reason
  ) values (
    association_uuid,
    auth.uid(),
    normalized_registry,
    normalized_email,
    'pending',
    case
      when association_row.registry_number is null or association_row.contact_email is null then 'missing_private_data'
      else 'mismatch'
    end
  ) returning id into request_uuid;

  update public.associations
  set claim_status = 'claim_pending'
  where id = association_uuid;

  if association_row.registry_number is null or association_row.contact_email is null then
    return 'KMG-CL-422';
  end if;

  return 'KMG-CL-403';
end;
$$;

grant execute on function public.claim_association(uuid, text, text) to authenticated;

create or replace function public.resolve_association_claim_request(
  claim_request_uuid uuid,
  decision_value text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.association_claim_requests;
  has_pending boolean;
begin
  if not public.is_platform_admin() then
    return 'KMG-AUTH-403';
  end if;

  if decision_value not in ('approved', 'rejected', 'locked') then
    return 'KMG-CL-001';
  end if;

  select *
  into request_row
  from public.association_claim_requests
  where id = claim_request_uuid
  for update;

  if not found then
    return 'KMG-CL-404';
  end if;

  if request_row.status <> 'pending' then
    return 'KMG-CL-409';
  end if;

  update public.association_claim_requests
  set status = decision_value,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = claim_request_uuid;

  if decision_value = 'approved' then
    update public.associations
    set claim_status = 'claimed',
        created_by = request_row.claimant_user_id,
        contact_email = contact_email_attempted,
        contact_notification_opt_in_status = case
          when contact_notification_opt_in_status = 'withdrawn' then 'pending'
          else contact_notification_opt_in_status
        end
    where id = request_row.association_id;

    insert into public.association_members (association_id, user_id, role, status, referred_by, reviewed_by, reviewed_at)
    values (request_row.association_id, request_row.claimant_user_id, 'association_admin', 'active', null, auth.uid(), now())
    on conflict (association_id, user_id) do update
    set role = 'association_admin',
        status = 'active',
        reviewed_by = auth.uid(),
        reviewed_at = now();

    return 'ok';
  end if;

  if decision_value = 'locked' then
    update public.associations
    set claim_status = 'claim_locked'
    where id = request_row.association_id;

    return 'ok';
  end if;

  select exists (
    select 1
    from public.association_claim_requests
    where association_id = request_row.association_id
      and status = 'pending'
      and id <> claim_request_uuid
  ) into has_pending;

  if not has_pending then
    update public.associations
    set claim_status = 'unclaimed'
    where id = request_row.association_id
      and claim_status = 'claim_pending';
  end if;

  return 'ok';
end;
$$;

grant execute on function public.resolve_association_claim_request(uuid, text) to authenticated;

select public.attach_audit_trigger('association_claim_requests')
where exists (
  select 1
  from pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  where pg_namespace.nspname = 'public'
    and pg_proc.proname = 'attach_audit_trigger'
);