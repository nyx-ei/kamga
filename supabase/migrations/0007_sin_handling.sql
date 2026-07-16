-- Ticket #9: transient SIN reveal, audit, and destruction on terminal review.
create table if not exists public.sin_reveal_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  membership_id uuid not null references public.association_members(id) on delete cascade,
  revealed_by uuid not null references public.users(id) on delete cascade,
  revealed_at timestamptz not null default now()
);

alter table public.sin_reveal_audit_logs enable row level security;

create index if not exists sin_reveal_audit_logs_membership_id_idx on public.sin_reveal_audit_logs(membership_id);
create index if not exists sin_reveal_audit_logs_revealed_by_idx on public.sin_reveal_audit_logs(revealed_by);
create index if not exists sin_reveal_audit_logs_revealed_at_idx on public.sin_reveal_audit_logs(revealed_at);

drop policy if exists "Association admins can manage member SIN tokens" on public.sin_tokens;
drop policy if exists "Platform admins can manage SIN tokens" on public.sin_tokens;

drop policy if exists "Authenticated users can read SIN reveal audit logs" on public.sin_reveal_audit_logs;
drop policy if exists "Platform admins can read SIN reveal audit logs" on public.sin_reveal_audit_logs;
drop policy if exists "Platform admins can manage SIN reveal audit logs" on public.sin_reveal_audit_logs;

create or replace function public.review_member_application(
  membership_uuid uuid,
  decision_value public.membership_status,
  decline_reason_html_value text default null
)
returns table (
  destroyed_storage_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_row public.association_members;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  if decision_value not in ('active', 'declined') then
    raise exception 'KMG-RG-001';
  end if;

  select *
  into membership_row
  from public.association_members
  where id = membership_uuid
  for update;

  if membership_row.id is null then
    raise exception 'KMG-RG-404';
  end if;

  if membership_row.status <> 'pending' then
    raise exception 'KMG-RG-409';
  end if;

  if not (public.is_platform_admin() or public.is_association_admin(membership_row.association_id)) then
    raise exception 'KMG-AUTH-403';
  end if;

  update public.association_members
  set status = decision_value,
      decline_reason_html = case when decision_value = 'declined' then decline_reason_html_value else null end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = membership_uuid;

  update public.evidence_uploads
  set status = 'destroyed'
  where membership_id = membership_uuid
    and status <> 'destroyed';

  delete from public.sin_tokens
  where membership_id = membership_uuid;

  return query
  select evidence.storage_path
  from public.evidence_uploads evidence
  where evidence.membership_id = membership_uuid;
end;
$$;

grant execute on function public.review_member_application(uuid, public.membership_status, text) to authenticated;
