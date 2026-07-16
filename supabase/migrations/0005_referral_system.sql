-- Ticket #7: referral token creation, validation, and atomic consumption.
create index if not exists referral_tokens_unused_token_idx
on public.referral_tokens(token)
where used_by is null;

create or replace function public.can_create_referral_token(association_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.associations associations
    where associations.id = association_uuid
      and associations.status = 'active'
      and (
        public.is_platform_admin()
        or public.is_association_admin(association_uuid)
        or (
          associations.allow_member_referrals = true
          and public.is_association_member(association_uuid)
        )
      )
  );
$$;

create or replace function public.create_referral_token(association_uuid uuid, token_value text)
returns public.referral_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  created_token public.referral_tokens;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  if length(token_value) <> 21 then
    raise exception 'KMG-REF-001';
  end if;

  if not public.can_create_referral_token(association_uuid) then
    raise exception 'KMG-AUTH-403';
  end if;

  insert into public.referral_tokens (token, association_id, created_by, expires_at)
  values (token_value, association_uuid, auth.uid(), now() + interval '30 days')
  returning * into created_token;

  return created_token;
end;
$$;

create or replace function public.consume_referral_token(token_value text)
returns table (
  referral_token_id uuid,
  association_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  return query
  update public.referral_tokens tokens
  set used_by = auth.uid(),
      used_at = now()
  from public.associations associations
  where tokens.association_id = associations.id
    and tokens.token = token_value
    and tokens.used_by is null
    and tokens.expires_at > now()
    and associations.status = 'active'
  returning tokens.id, tokens.association_id;

  if not found then
    raise exception 'KMG-REF-004';
  end if;
end;
$$;

grant execute on function public.can_create_referral_token(uuid) to authenticated;
grant execute on function public.create_referral_token(uuid, text) to authenticated;
grant execute on function public.consume_referral_token(text) to authenticated;