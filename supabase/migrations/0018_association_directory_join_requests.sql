-- Ticket #20: public association directory and direct join requests.
create extension if not exists pg_trgm with schema extensions;

alter table public.associations
add column if not exists description text;

create index if not exists associations_name_trgm_idx on public.associations using gin (name extensions.gin_trgm_ops);
create index if not exists associations_city_trgm_idx on public.associations using gin (city extensions.gin_trgm_ops);

create or replace function public.request_to_join_association(association_uuid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  association_row public.associations;
  membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  select *
  into association_row
  from public.associations
  where id = association_uuid
    and status = 'active';

  if association_row.id is null then
    raise exception 'KMG-RG-404';
  end if;

  insert into public.association_members (association_id, user_id, role, status)
  values (association_uuid, auth.uid(), 'member', 'pending')
  on conflict (association_id, user_id) do nothing
  returning id into membership_id;

  if membership_id is null then
    select id
    into membership_id
    from public.association_members
    where association_id = association_uuid
      and user_id = auth.uid();
  end if;

  return membership_id;
end;
$$;

grant execute on function public.request_to_join_association(uuid) to authenticated;
