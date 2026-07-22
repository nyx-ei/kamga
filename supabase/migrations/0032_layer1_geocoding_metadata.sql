-- Layer 1 geocoding metadata: track provider, query, and timestamp for public lookup coordinates.
alter table public.associations
add column if not exists geocode_provider text,
add column if not exists geocode_query text,
add column if not exists geocoded_at timestamptz;

create index if not exists associations_geocoded_at_idx on public.associations(geocoded_at desc) where geocoded_at is not null;