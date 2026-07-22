-- Layer 1 admin record management: duplicate association merge with preserved provenance.

alter table public.associations
  add column if not exists merged_into_association_id uuid references public.associations(id) on delete set null,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by uuid references public.users(id) on delete set null;

create index if not exists associations_merged_into_association_id_idx
  on public.associations(merged_into_association_id)
  where merged_into_association_id is not null;

create or replace function public.merge_association_records(
  canonical_association_uuid uuid,
  duplicate_association_uuid uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_row public.associations%rowtype;
  duplicate_row public.associations%rowtype;
  actor_uuid uuid := auth.uid();
  merged_aliases text[];
begin
  if actor_uuid is null then
    return 'KMG-AUTH-401';
  end if;

  if not public.is_platform_admin() then
    return 'KMG-AUTH-403';
  end if;

  if canonical_association_uuid = duplicate_association_uuid then
    return 'KMG-MG-001';
  end if;

  select * into canonical_row
  from public.associations
  where id = canonical_association_uuid
  for update;

  select * into duplicate_row
  from public.associations
  where id = duplicate_association_uuid
  for update;

  if canonical_row.id is null or duplicate_row.id is null then
    return 'KMG-MG-404';
  end if;

  if duplicate_row.merged_into_association_id is not null then
    return 'KMG-MG-409';
  end if;

  select array(
    select distinct trimmed_alias
    from (
      select btrim(value) as trimmed_alias
      from unnest(
        coalesce(canonical_row.aliases, '{}'::text[]) ||
        coalesce(duplicate_row.aliases, '{}'::text[]) ||
        array[duplicate_row.official_name, duplicate_row.common_name, duplicate_row.name]
      ) as value
    ) aliases
    where trimmed_alias is not null and trimmed_alias <> ''
    order by trimmed_alias
  ) into merged_aliases;

  update public.associations
  set
    aliases = merged_aliases,
    city = coalesce(nullif(canonical_row.city, ''), duplicate_row.city),
    claim_status = case
      when canonical_row.claim_status = 'claimed' or duplicate_row.claim_status = 'claimed' then 'claimed'
      when canonical_row.claim_status = 'claim_locked' or duplicate_row.claim_status = 'claim_locked' then 'claim_locked'
      when canonical_row.claim_status = 'claim_pending' or duplicate_row.claim_status = 'claim_pending' then 'claim_pending'
      else canonical_row.claim_status
    end,
    common_name = coalesce(nullif(canonical_row.common_name, ''), duplicate_row.common_name),
    contact_email = coalesce(canonical_row.contact_email, duplicate_row.contact_email),
    contact_notification_opt_in_status = case
      when canonical_row.contact_notification_opt_in_status = 'confirmed' or duplicate_row.contact_notification_opt_in_status = 'confirmed' then 'confirmed'
      when canonical_row.contact_notification_opt_in_status = 'pending' or duplicate_row.contact_notification_opt_in_status = 'pending' then 'pending'
      else canonical_row.contact_notification_opt_in_status
    end,
    created_by = coalesce(canonical_row.created_by, duplicate_row.created_by),
    description = coalesce(nullif(canonical_row.description, ''), duplicate_row.description),
    geocode_status = case
      when canonical_row.geocode_status = 'geocoded' or duplicate_row.geocode_status = 'geocoded' then 'geocoded'
      when canonical_row.geocode_status = 'needs_review' or duplicate_row.geocode_status = 'needs_review' then 'needs_review'
      when canonical_row.geocode_status = 'failed' and duplicate_row.geocode_status = 'failed' then 'failed'
      else canonical_row.geocode_status
    end,
    latitude = coalesce(canonical_row.latitude, duplicate_row.latitude),
    longitude = coalesce(canonical_row.longitude, duplicate_row.longitude),
    name = coalesce(nullif(canonical_row.name, ''), duplicate_row.name),
    official_name = coalesce(nullif(canonical_row.official_name, ''), duplicate_row.official_name),
    postal_code = coalesce(canonical_row.postal_code, duplicate_row.postal_code),
    primary_language = case
      when canonical_row.primary_language = duplicate_row.primary_language then canonical_row.primary_language
      else 'fr_en'
    end,
    province = coalesce(nullif(canonical_row.province, ''), duplicate_row.province),
    public_contact_email = canonical_row.public_contact_email or duplicate_row.public_contact_email,
    public_precision = case
      when canonical_row.public_precision = 'exact' or duplicate_row.public_precision = 'exact' then 'exact'
      else 'neighbourhood'
    end,
    registry_number = coalesce(canonical_row.registry_number, duplicate_row.registry_number),
    registry_type = coalesce(canonical_row.registry_type, duplicate_row.registry_type),
    rpn_affiliation_proof_path = coalesce(canonical_row.rpn_affiliation_proof_path, duplicate_row.rpn_affiliation_proof_path),
    source = case
      when duplicate_row.created_at < canonical_row.created_at then duplicate_row.source
      else canonical_row.source
    end,
    status = case
      when canonical_row.status = 'active' or duplicate_row.status = 'active' then 'active'
      when canonical_row.status = 'pending_review' or duplicate_row.status = 'pending_review' then 'pending_review'
      when canonical_row.status = 'suspended' or duplicate_row.status = 'suspended' then 'suspended'
      else canonical_row.status
    end,
    street_address = coalesce(canonical_row.street_address, duplicate_row.street_address),
    updated_at = now(),
    verification_status = case
      when canonical_row.verification_status = 'verified' or duplicate_row.verification_status = 'verified' then 'verified'
      when canonical_row.verification_status = 'needs_review' or duplicate_row.verification_status = 'needs_review' then 'needs_review'
      else canonical_row.verification_status
    end
  where id = canonical_association_uuid;

  update public.association_members duplicate_member
  set association_id = canonical_association_uuid
  where duplicate_member.association_id = duplicate_association_uuid
    and not exists (
      select 1
      from public.association_members canonical_member
      where canonical_member.association_id = canonical_association_uuid
        and canonical_member.user_id = duplicate_member.user_id
    );

  delete from public.association_members duplicate_member
  where duplicate_member.association_id = duplicate_association_uuid
    and exists (
      select 1
      from public.association_members canonical_member
      where canonical_member.association_id = canonical_association_uuid
        and canonical_member.user_id = duplicate_member.user_id
    );

  update public.referral_tokens
  set association_id = canonical_association_uuid
  where association_id = duplicate_association_uuid;

  if to_regclass('public.association_connect_requests') is not null then
    execute 'update public.association_connect_requests set association_id = $1 where association_id = $2'
    using canonical_association_uuid, duplicate_association_uuid;
  end if;

  if to_regclass('public.association_claim_requests') is not null then
    execute 'update public.association_claim_requests set association_id = $1 where association_id = $2'
    using canonical_association_uuid, duplicate_association_uuid;
  end if;

  if to_regclass('public.association_contact_opt_in_tokens') is not null then
    execute 'update public.association_contact_opt_in_tokens set association_id = $1 where association_id = $2'
    using canonical_association_uuid, duplicate_association_uuid;
  end if;

  if to_regclass('public.association_admin_fees') is not null then
    execute 'update public.association_admin_fees set association_id = $1 where association_id = $2'
    using canonical_association_uuid, duplicate_association_uuid;
  end if;

  if to_regclass('public.association_admin_fee_payouts') is not null then
    execute 'update public.association_admin_fee_payouts set association_id = $1 where association_id = $2'
    using canonical_association_uuid, duplicate_association_uuid;
  end if;

  if to_regclass('public.association_admin_fee_settings') is not null then
    delete from public.association_admin_fee_settings settings
    where settings.association_id = duplicate_association_uuid
      and exists (
        select 1
        from public.association_admin_fee_settings canonical_settings
        where canonical_settings.association_id = canonical_association_uuid
      );

    update public.association_admin_fee_settings
    set association_id = canonical_association_uuid
    where association_id = duplicate_association_uuid;
  end if;

  if to_regclass('public.association_levee_calls') is not null then
    update public.association_levee_calls canonical_call
    set
      share_count = canonical_call.share_count + duplicate_call.share_count,
      amount_due_cents = canonical_call.amount_due_cents + duplicate_call.amount_due_cents,
      status = case
        when canonical_call.status = 'completed' and duplicate_call.status = 'completed' then 'completed'
        when canonical_call.status = 'in_progress' or duplicate_call.status = 'in_progress' then 'in_progress'
        else 'pending'
      end,
      updated_at = now()
    from public.association_levee_calls duplicate_call
    where canonical_call.association_id = canonical_association_uuid
      and duplicate_call.association_id = duplicate_association_uuid
      and canonical_call.levee_id = duplicate_call.levee_id;

    delete from public.association_levee_calls duplicate_call
    where duplicate_call.association_id = duplicate_association_uuid
      and exists (
        select 1
        from public.association_levee_calls canonical_call
        where canonical_call.association_id = canonical_association_uuid
          and canonical_call.levee_id = duplicate_call.levee_id
      );

    update public.association_levee_calls
    set association_id = canonical_association_uuid
    where association_id = duplicate_association_uuid;
  end if;

  if to_regclass('public.pilot_associations') is not null then
    delete from public.pilot_associations duplicate_pilot
    where duplicate_pilot.association_id = duplicate_association_uuid
      and exists (
        select 1
        from public.pilot_associations canonical_pilot
        where canonical_pilot.association_id = canonical_association_uuid
      );

    update public.pilot_associations
    set association_id = canonical_association_uuid
    where association_id = duplicate_association_uuid;
  end if;

  if to_regclass('public.association_recruit_leads') is not null then
    update public.association_recruit_leads canonical_lead
    set
      demand_count = greatest(canonical_lead.demand_count, duplicate_lead.demand_count),
      updated_at = now()
    from public.association_recruit_leads duplicate_lead
    where canonical_lead.demand_association_id = canonical_association_uuid
      and duplicate_lead.demand_association_id = duplicate_association_uuid
      and canonical_lead.lead_type = 'high_connect_demand'
      and duplicate_lead.lead_type = 'high_connect_demand'
      and canonical_lead.status in ('new', 'contacted')
      and duplicate_lead.status in ('new', 'contacted');

    delete from public.association_recruit_leads duplicate_lead
    where duplicate_lead.demand_association_id = duplicate_association_uuid
      and duplicate_lead.lead_type = 'high_connect_demand'
      and duplicate_lead.status in ('new', 'contacted')
      and exists (
        select 1
        from public.association_recruit_leads canonical_lead
        where canonical_lead.demand_association_id = canonical_association_uuid
          and canonical_lead.lead_type = 'high_connect_demand'
          and canonical_lead.status in ('new', 'contacted')
      );

    update public.association_recruit_leads
    set demand_association_id = canonical_association_uuid
    where demand_association_id = duplicate_association_uuid;
  end if;

  update public.associations
  set
    claim_status = 'claim_locked',
    merged_at = now(),
    merged_by = actor_uuid,
    merged_into_association_id = canonical_association_uuid,
    status = 'suspended',
    updated_at = now(),
    verification_status = 'needs_review'
  where id = duplicate_association_uuid;

  return 'ok';
end;
$$;

grant execute on function public.merge_association_records(uuid, uuid) to authenticated;