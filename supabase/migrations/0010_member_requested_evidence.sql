-- Ticket #13: persist member evidence requests for member-facing upload flows.
alter table public.association_members
add column if not exists requested_evidence_types public.evidence_type[] null;

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

  if membership_row.status not in ('pending', 'needs_more_evidence') then
    raise exception 'KMG-RG-409';
  end if;

  if not (public.is_platform_admin() or public.is_association_admin(membership_row.association_id)) then
    raise exception 'KMG-AUTH-403';
  end if;

  update public.association_members
  set status = decision_value,
      decline_reason_html = case when decision_value = 'declined' then decline_reason_html_value else null end,
      requested_evidence_types = null,
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
