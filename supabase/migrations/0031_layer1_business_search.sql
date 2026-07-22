-- Layer 1 business search: two-band public lookup with location and identity resolvers.
create or replace function public.normalize_lookup_text(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(translate(coalesce(value, ''), 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ', 'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyyoeae')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.normalize_lookup_key(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(public.normalize_lookup_text(value), '\s+', '', 'g');
$$;

create or replace function public.lookup_distance_km(
  origin_latitude double precision,
  origin_longitude double precision,
  target_latitude double precision,
  target_longitude double precision
)
returns double precision
language sql
immutable
as $$
  select 6371 * 2 * asin(
    sqrt(
      power(sin(radians((target_latitude - origin_latitude) / 2)), 2)
      + cos(radians(origin_latitude))
      * cos(radians(target_latitude))
      * power(sin(radians((target_longitude - origin_longitude) / 2)), 2)
    )
  );
$$;

drop function if exists public.search_public_associations(text, numeric, boolean);
drop function if exists public.search_public_associations(text, numeric, boolean, double precision, double precision, text);

create or replace function public.search_public_associations(
  search_query_value text default '',
  radius_km_value numeric default 10,
  verified_only_value boolean default false,
  user_latitude_value double precision default null,
  user_longitude_value double precision default null,
  origin_label_value text default null
)
returns table (
  row_type text,
  id uuid,
  display_name text,
  city text,
  province text,
  description text,
  primary_language text,
  verification_status text,
  claim_status text,
  public_precision text,
  latitude double precision,
  longitude double precision,
  match_reason text,
  distance_km double precision,
  identity_score integer,
  result_rank integer,
  total_results integer,
  origin_label text,
  location_resolved boolean,
  ambiguous_location boolean
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  normalized_query text := public.normalize_lookup_text(search_query_value);
  normalized_key text := public.normalize_lookup_key(search_query_value);
  effective_radius double precision := greatest(1, least(coalesce(radius_km_value, 10), 50))::double precision;
  origin_latitude double precision;
  origin_longitude double precision;
  resolved_origin_label text;
  resolved_location boolean := false;
  city_province_count integer := 0;
begin
  if user_latitude_value is not null and user_longitude_value is not null then
    origin_latitude := user_latitude_value;
    origin_longitude := user_longitude_value;
    resolved_origin_label := coalesce(nullif(trim(origin_label_value), ''), 'your location');
    resolved_location := true;
    city_province_count := 1;
  end if;

  if normalized_query <> '' and not resolved_location then
    select avg(latitude), avg(longitude), min(city), count(distinct province)
    into origin_latitude, origin_longitude, resolved_origin_label, city_province_count
    from public.associations
    where status = 'active'
      and geocode_status = 'geocoded'
      and latitude is not null
      and longitude is not null
      and public.normalize_lookup_text(city) = normalized_query;

    if origin_latitude is not null and origin_longitude is not null then
      resolved_location := city_province_count <= 1;
    end if;

    if not resolved_location then
      select latitude, longitude, coalesce(city, search_query_value), 1
      into origin_latitude, origin_longitude, resolved_origin_label, city_province_count
      from public.associations
      where status = 'active'
        and geocode_status = 'geocoded'
        and latitude is not null
        and longitude is not null
        and postal_code is not null
        and public.normalize_lookup_key(postal_code) like normalized_key || '%'
      order by updated_at desc nulls last, name asc
      limit 1;

      resolved_location := origin_latitude is not null and origin_longitude is not null;
    end if;

    if not resolved_location then
      select avg(latitude), avg(longitude), min(city), 1
      into origin_latitude, origin_longitude, resolved_origin_label, city_province_count
      from public.associations
      where status = 'active'
        and geocode_status = 'geocoded'
        and latitude is not null
        and longitude is not null
        and public.normalize_lookup_text(coalesce(street_address, '') || ' ' || coalesce(city, '') || ' ' || coalesce(postal_code, '')) like '%' || normalized_query || '%';

      resolved_location := origin_latitude is not null and origin_longitude is not null;
    end if;
  end if;

  return query
  with base as (
    select
      a.id,
      coalesce(nullif(a.common_name, ''), a.official_name, a.name) as display_name,
      a.city,
      a.province,
      a.description,
      a.primary_language::text as primary_language,
      a.verification_status::text as verification_status,
      a.claim_status::text as claim_status,
      a.public_precision::text as public_precision,
      a.latitude,
      a.longitude,
      a.aliases,
      case
        when normalized_query = '' then 0
        when exists (
          select 1
          from unnest(array_append(coalesce(a.aliases, '{}'::text[]), coalesce(nullif(a.common_name, ''), a.official_name, a.name))) as candidate(value)
          where public.normalize_lookup_text(candidate.value) = normalized_query
        ) then 100
        when exists (
          select 1
          from unnest(array_append(coalesce(a.aliases, '{}'::text[]), coalesce(nullif(a.common_name, ''), a.official_name, a.name))) as candidate(value)
          where public.normalize_lookup_text(candidate.value) like normalized_query || '%'
        ) then 80
        when exists (
          select 1
          from unnest(array_append(coalesce(a.aliases, '{}'::text[]), coalesce(nullif(a.common_name, ''), a.official_name, a.name))) as candidate(value)
          where public.normalize_lookup_text(candidate.value) like '%' || normalized_query || '%'
        ) then 60
        else 0
      end as identity_score,
      case
        when resolved_location then public.lookup_distance_km(origin_latitude, origin_longitude, a.latitude, a.longitude)
        else null
      end as distance_km
    from public.associations a
    where a.status = 'active'
      and a.geocode_status = 'geocoded'
      and a.latitude is not null
      and a.longitude is not null
      and (not verified_only_value or a.verification_status = 'verified')
  ), ranked as (
    select
      b.*,
      case
        when normalized_query <> '' and b.identity_score > 0 then 'identity'
        when resolved_location and b.distance_km <= effective_radius then 'location'
        when normalized_query = '' then 'directory'
        else null
      end as match_reason
    from base b
  ), result_rows as (
    select
      r.*,
      row_number() over (
        order by
          case when r.match_reason = 'identity' then 1 else 2 end,
          case when r.match_reason = 'identity' then r.identity_score else 0 end desc,
          case when r.match_reason = 'location' then r.distance_km else null end asc nulls last,
          case when r.verification_status = 'verified' then 0 else 1 end,
          r.display_name asc
      )::integer as result_rank
    from ranked r
    where r.match_reason is not null
  ), result_count as (
    select count(*)::integer as total from result_rows
  ), nearest_rows as (
    select
      b.*,
      row_number() over (order by b.distance_km asc nulls last, b.display_name asc)::integer as result_rank
    from base b
    where resolved_location
      and not exists (select 1 from result_rows)
    order by b.distance_km asc nulls last, b.display_name asc
    limit 3
  )
  select
    'result'::text,
    rr.id,
    rr.display_name,
    rr.city,
    rr.province,
    rr.description,
    rr.primary_language,
    rr.verification_status,
    rr.claim_status,
    rr.public_precision,
    rr.latitude,
    rr.longitude,
    rr.match_reason,
    case when rr.match_reason = 'location' then rr.distance_km else null end,
    rr.identity_score,
    rr.result_rank,
    (select total from result_count),
    resolved_origin_label,
    resolved_location,
    city_province_count > 1
  from result_rows rr

  union all

  select
    'nearest'::text,
    nr.id,
    nr.display_name,
    nr.city,
    nr.province,
    nr.description,
    nr.primary_language,
    nr.verification_status,
    nr.claim_status,
    nr.public_precision,
    nr.latitude,
    nr.longitude,
    'location'::text,
    nr.distance_km,
    nr.identity_score,
    nr.result_rank,
    (select total from result_count),
    resolved_origin_label,
    resolved_location,
    city_province_count > 1
  from nearest_rows nr

  union all

  select
    'meta'::text,
    null::uuid,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::double precision,
    null::double precision,
    null::text,
    null::double precision,
    null::integer,
    null::integer,
    (select total from result_count),
    resolved_origin_label,
    resolved_location,
    city_province_count > 1
  where not exists (select 1 from result_rows)
    and not exists (select 1 from nearest_rows);
end;
$$;

grant execute on function public.search_public_associations(text, numeric, boolean, double precision, double precision, text) to anon, authenticated;