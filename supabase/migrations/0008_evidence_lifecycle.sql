-- Ticket #10: evidence storage bucket and lifecycle cleanup support.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidences',
  'evidences',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.mark_evidence_destroyed(evidence_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  evidence_row public.evidence_uploads;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  select *
  into evidence_row
  from public.evidence_uploads
  where id = evidence_uuid
  for update;

  if evidence_row.id is null then
    raise exception 'KMG-RG-404';
  end if;

  if not public.is_platform_admin() then
    raise exception 'KMG-AUTH-403';
  end if;

  update public.evidence_uploads
  set status = 'destroyed'
  where id = evidence_uuid;
end;
$$;

grant execute on function public.mark_evidence_destroyed(uuid) to authenticated;
