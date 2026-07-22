-- Layer 1 registry verification metadata: store external check outcome without exposing private registry data publicly.
alter table public.associations
add column if not exists registry_provider text,
add column if not exists registry_checked_at timestamptz,
add column if not exists registry_matched_name text,
add column if not exists registry_match_confidence numeric(5, 4),
add column if not exists registry_verification_reason text;

create index if not exists associations_registry_checked_at_idx on public.associations(registry_checked_at desc) where registry_checked_at is not null;
create index if not exists associations_registry_verification_reason_idx on public.associations(registry_verification_reason) where registry_verification_reason is not null;
