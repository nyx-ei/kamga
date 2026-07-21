-- Layer 1 claim listing: ownership proof and association-admin activation.
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

  if association_row.claim_status <> 'unclaimed' then
    return 'KMG-CL-409';
  end if;

  if normalized_registry is null or normalized_email is null then
    return 'KMG-CL-001';
  end if;

  if association_row.registry_number is null or association_row.contact_email is null then
    update public.associations
    set claim_status = 'claim_pending'
    where id = association_uuid;

    return 'KMG-CL-422';
  end if;

  if lower(association_row.registry_number) <> lower(normalized_registry)
     or lower(association_row.contact_email) <> normalized_email then
    update public.associations
    set claim_status = 'claim_pending'
    where id = association_uuid;

    return 'KMG-CL-403';
  end if;

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
end;
$$;

grant execute on function public.claim_association(uuid, text, text) to authenticated;