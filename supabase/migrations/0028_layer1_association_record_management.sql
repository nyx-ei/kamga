-- Layer 1 association record management: consented public contact projection.
create or replace view public.public_association_directory
with (security_invoker = true)
as
select
  id,
  coalesce(nullif(common_name, ''), official_name, name) as display_name,
  city,
  province,
  description,
  primary_language,
  verification_status,
  claim_status,
  public_precision,
  case when public_precision = 'exact' then street_address else null end as public_street_address,
  case when public_contact_email then contact_email else null end as public_contact_email,
  latitude,
  longitude,
  geocode_status,
  updated_at
from public.associations
where status = 'active'
  and (geocode_status in ('pending', 'geocoded') or latitude is null or longitude is null);

grant select on public.public_association_directory to anon, authenticated;