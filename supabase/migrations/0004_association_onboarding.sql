-- Ticket #6: association onboarding support and review transitions.
alter table public.associations
add column if not exists rpn_affiliation_proof_path text;

create index if not exists associations_created_by_status_idx on public.associations(created_by, status);

create or replace function public.is_association_creator(association_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.associations
    where id = association_uuid
      and created_by = auth.uid()
  );
$$;

grant execute on function public.is_association_creator(uuid) to authenticated;

drop policy if exists "Association creators can read own associations" on public.associations;
create policy "Association creators can read own associations"
on public.associations
for select
to authenticated
using (created_by = auth.uid());

create or replace function public.approve_association(association_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  creator uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'KMG-AUTH-403';
  end if;

  update public.associations
  set status = 'active'
  where id = association_uuid
  returning created_by into creator;

  if creator is null then
    raise exception 'KMG-RG-404';
  end if;

  insert into public.association_members (association_id, user_id, role, status, reviewed_by, reviewed_at)
  values (association_uuid, creator, 'association_admin', 'active', auth.uid(), now())
  on conflict (association_id, user_id) do update
  set role = 'association_admin',
      status = 'active',
      reviewed_by = auth.uid(),
      reviewed_at = now();
end;
$$;

create or replace function public.suspend_association(association_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'KMG-AUTH-403';
  end if;

  update public.associations
  set status = 'suspended'
  where id = association_uuid;

  if not found then
    raise exception 'KMG-RG-404';
  end if;
end;
$$;

grant execute on function public.approve_association(uuid) to authenticated;
grant execute on function public.suspend_association(uuid) to authenticated;
