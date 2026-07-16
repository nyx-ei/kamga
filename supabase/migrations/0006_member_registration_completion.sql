-- Ticket #8: complete referral-only member registration in a single database transaction.
create or replace function public.complete_referral_member_registration(
  token_value text,
  membership_uuid uuid,
  first_name_value text,
  last_name_value text,
  email_value text,
  phone_value text,
  date_of_arrival_canada_value date,
  government_id_path text,
  immigration_proof_path text,
  encrypted_sin_hex text,
  iv_hex text
)
returns table (
  membership_id uuid,
  association_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token_row public.referral_tokens;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  update public.referral_tokens tokens
  set used_by = auth.uid(),
      used_at = now()
  from public.associations associations
  where tokens.association_id = associations.id
    and tokens.token = token_value
    and tokens.used_by is null
    and tokens.expires_at > now()
    and associations.status = 'active'
  returning tokens.* into token_row;

  if token_row.id is null then
    raise exception 'KMG-REF-004';
  end if;

  update public.users
  set first_name = first_name_value,
      last_name = last_name_value,
      email = email_value,
      phone = phone_value,
      date_of_arrival_canada = date_of_arrival_canada_value
  where id = auth.uid();

  insert into public.association_members (id, association_id, user_id, role, status)
  values (membership_uuid, token_row.association_id, auth.uid(), 'member', 'pending');

  insert into public.evidence_uploads (membership_id, evidence_type, storage_path, status)
  values
    (membership_uuid, 'government_id', government_id_path, 'uploaded'),
    (membership_uuid, 'immigration_proof', immigration_proof_path, 'uploaded');

  insert into public.sin_tokens (membership_id, encrypted_sin, iv)
  values (membership_uuid, decode(encrypted_sin_hex, 'hex'), decode(iv_hex, 'hex'));

  return query select membership_uuid, token_row.association_id;
end;
$$;

grant execute on function public.complete_referral_member_registration(text, uuid, text, text, text, text, date, text, text, text, text) to authenticated;