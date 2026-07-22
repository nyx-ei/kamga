-- Layer 1 connect request lifecycle: privacy retention and demand escalation.
alter table public.association_connect_requests
add column if not exists anonymized_at timestamptz,
add column if not exists retention_until timestamptz not null default (now() + interval '30 days');

create index if not exists association_connect_requests_retention_idx
on public.association_connect_requests(retention_until)
where anonymized_at is null;

alter table public.association_recruit_leads
add column if not exists demand_association_id uuid references public.associations(id) on delete set null,
add column if not exists lead_type text not null default 'uncovered_search' check (lead_type in ('uncovered_search', 'high_connect_demand')),
add column if not exists demand_count integer not null default 0 check (demand_count >= 0);

create index if not exists association_recruit_leads_demand_association_idx
on public.association_recruit_leads(demand_association_id)
where demand_association_id is not null;

create unique index if not exists association_recruit_leads_open_high_demand_uidx
on public.association_recruit_leads(demand_association_id)
where lead_type = 'high_connect_demand' and status in ('new', 'contacted');

create or replace function public.increment_connect_request_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
  association_name text;
  association_city text;
begin
  update public.associations
  set connect_request_count = connect_request_count + 1
  where id = new.association_id
  returning connect_request_count, coalesce(nullif(common_name, ''), official_name, name), city
  into next_count, association_name, association_city;

  if next_count >= 50 then
    insert into public.association_recruit_leads (
      search_query,
      city,
      locale,
      association_name,
      message,
      status,
      demand_association_id,
      lead_type,
      demand_count
    )
    values (
      association_name,
      association_city,
      coalesce(nullif(new.locale, ''), 'en'),
      association_name,
      'High public connect demand threshold reached for this association.',
      'new',
      new.association_id,
      'high_connect_demand',
      next_count
    )
    on conflict (demand_association_id) where lead_type = 'high_connect_demand' and status in ('new', 'contacted')
    do update set
      demand_count = greatest(public.association_recruit_leads.demand_count, excluded.demand_count),
      updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.anonymize_expired_connect_requests(limit_value integer default 100)
returns table(processed integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  processed_count integer;
begin
  with candidates as (
    select id
    from public.association_connect_requests
    where anonymized_at is null
      and retention_until <= now()
    order by retention_until asc
    limit greatest(1, least(coalesce(limit_value, 100), 500))
  ), updated_rows as (
    update public.association_connect_requests requests
    set requester_email = null,
        requester_phone = null,
        requester_name = 'Anonymized requester',
        message = '[anonymized after retention window]',
        requester_ip_hash = null,
        reply_channel_hash = null,
        anonymized_at = now()
    from candidates
    where requests.id = candidates.id
    returning requests.id
  )
  select count(*) into processed_count from updated_rows;

  return query select processed_count;
end;
$$;

grant execute on function public.anonymize_expired_connect_requests(integer) to authenticated;
