-- Ticket #19: remittance tracking and levee closure.
alter table public.association_levee_calls
add column if not exists remitted_at timestamptz,
add column if not exists remitted_by uuid references public.users(id) on delete set null;

create index if not exists association_levee_calls_remitted_at_idx on public.association_levee_calls(remitted_at);

create or replace view public.association_levee_collection_summary
with (security_invoker = true)
as
select
  calls.id as association_levee_call_id,
  calls.association_id,
  calls.levee_id,
  calls.amount_due_cents as target_amount_cents,
  coalesce(sum(contributions.amount_paid_cents), 0)::numeric(14, 2) as collected_amount_cents,
  greatest(calls.amount_due_cents - coalesce(sum(contributions.amount_paid_cents), 0), 0)::numeric(14, 2) as outstanding_amount_cents,
  calls.remitted_at,
  calls.remitted_by,
  count(contributions.id)::integer as member_count,
  count(contributions.id) filter (where contributions.status = 'paid')::integer as paid_member_count,
  count(contributions.id) filter (where contributions.status = 'partial')::integer as partial_member_count,
  count(contributions.id) filter (where contributions.status = 'unpaid')::integer as unpaid_member_count
from public.association_levee_calls calls
left join public.member_contributions contributions on contributions.association_levee_call_id = calls.id
group by calls.id, calls.association_id, calls.levee_id, calls.amount_due_cents, calls.remitted_at, calls.remitted_by;

grant select on public.association_levee_collection_summary to authenticated;

create or replace view public.levee_collection_progress
with (security_invoker = true)
as
select
  levees.id as levee_id,
  levees.target_amount_cents,
  levees.deadline,
  levees.status,
  coalesce(sum(summary.collected_amount_cents), 0)::numeric(14, 2) as collected_amount_cents,
  greatest(levees.target_amount_cents - coalesce(sum(summary.collected_amount_cents), 0), 0)::numeric(14, 2) as outstanding_amount_cents,
  count(summary.association_levee_call_id)::integer as association_count,
  count(summary.association_levee_call_id) filter (where summary.remitted_at is not null)::integer as remitted_association_count
from public.levees levees
left join public.association_levee_collection_summary summary on summary.levee_id = levees.id
group by levees.id, levees.target_amount_cents, levees.deadline, levees.status;

grant select on public.levee_collection_progress to authenticated;

create or replace function public.mark_association_levee_call_remitted(call_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  call_row public.association_levee_calls;
  summary_row public.association_levee_collection_summary;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  select *
  into call_row
  from public.association_levee_calls
  where id = call_uuid
  for update;

  if call_row.id is null then
    raise exception 'KMG-LV-404';
  end if;

  if not (public.is_platform_admin() or public.is_association_admin(call_row.association_id)) then
    raise exception 'KMG-AUTH-403';
  end if;

  select *
  into summary_row
  from public.association_levee_collection_summary
  where association_levee_call_id = call_uuid;

  if summary_row.collected_amount_cents < call_row.amount_due_cents then
    raise exception 'KMG-LV-003';
  end if;

  update public.association_levee_calls
  set
    remitted_at = coalesce(remitted_at, now()),
    remitted_by = coalesce(remitted_by, auth.uid()),
    status = 'completed'
  where id = call_uuid;
end;
$$;

grant execute on function public.mark_association_levee_call_remitted(uuid) to authenticated;

create or replace function public.close_levee_if_ready(levee_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  levee_row public.levees;
  progress_row public.levee_collection_progress;
begin
  if auth.uid() is null then
    raise exception 'KMG-AUTH-401';
  end if;

  if not public.is_platform_admin() then
    raise exception 'KMG-AUTH-403';
  end if;

  select *
  into levee_row
  from public.levees
  where id = levee_uuid
  for update;

  if levee_row.id is null then
    raise exception 'KMG-LV-404';
  end if;

  if levee_row.status <> 'active' then
    return;
  end if;

  select *
  into progress_row
  from public.levee_collection_progress
  where levee_id = levee_uuid;

  if progress_row.collected_amount_cents < levee_row.target_amount_cents and levee_row.deadline >= current_date then
    raise exception 'KMG-LV-003';
  end if;

  update public.levees
  set status = 'closed'
  where id = levee_uuid;
end;
$$;

grant execute on function public.close_levee_if_ready(uuid) to authenticated;
