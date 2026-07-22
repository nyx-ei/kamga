import { z } from 'zod';

import {
  ASSOCIATION_CLAIM_STATUSES,
  ASSOCIATION_PRIMARY_LANGUAGES,
  ASSOCIATION_PUBLIC_PRECISIONS,
  ASSOCIATION_VERIFICATION_STATUSES
} from '@/features/associations/association-types';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const publicAssociationSearchRowSchema = z.object({
  ambiguous_location: z.boolean().nullable(),
  city: z.string().nullable(),
  claim_status: z.enum(ASSOCIATION_CLAIM_STATUSES).nullable(),
  content_locale: z.enum(['en', 'fr', 'fr_en']).nullable(),
  description: z.string().nullable(),
  display_name: z.string().nullable(),
  distance_km: z.number().nullable(),
  id: z.string().uuid().nullable(),
  identity_score: z.number().nullable(),
  latitude: z.number().nullable(),
  location_resolved: z.boolean().nullable(),
  longitude: z.number().nullable(),
  match_reason: z.enum(['directory', 'identity', 'location']).nullable(),
  origin_label: z.string().nullable(),
  primary_language: z.enum(ASSOCIATION_PRIMARY_LANGUAGES).nullable(),
  province: z.string().nullable(),
  public_precision: z.enum(ASSOCIATION_PUBLIC_PRECISIONS).nullable(),
  result_rank: z.number().nullable(),
  row_type: z.enum(['meta', 'nearest', 'result']),
  total_results: z.number().nullable(),
  verification_status: z.enum(ASSOCIATION_VERIFICATION_STATUSES).nullable()
});

export type PublicAssociationSearchResult = {
  city: string;
  claimStatus: (typeof ASSOCIATION_CLAIM_STATUSES)[number];
  contentLocale: 'en' | 'fr' | 'fr_en';
  description: string | null;
  displayName: string;
  distanceKm: number | null;
  id: string;
  latitude: number;
  longitude: number;
  matchReason: 'directory' | 'identity' | 'location';
  primaryLanguage: (typeof ASSOCIATION_PRIMARY_LANGUAGES)[number];
  province: string;
  publicPrecision: (typeof ASSOCIATION_PUBLIC_PRECISIONS)[number];
  rank: number;
  verificationStatus: (typeof ASSOCIATION_VERIFICATION_STATUSES)[number];
};

export type PublicAssociationSearch = {
  ambiguousLocation: boolean;
  locationResolved: boolean;
  nearest: PublicAssociationSearchResult[];
  originLabel: string | null;
  results: PublicAssociationSearchResult[];
  totalResults: number;
};

type PublicAssociationSearchParams = {
  originLabel: string | null;
  query: string;
  radiusKm: number;
  uiLocale: 'en' | 'fr';
  userLatitude: number | null;
  userLongitude: number | null;
  verifiedOnly: boolean;
};

function isSearchResult(value: PublicAssociationSearchResult | null): value is PublicAssociationSearchResult {
  return value !== null;
}

function toSearchResult(row: z.infer<typeof publicAssociationSearchRowSchema>): PublicAssociationSearchResult | null {
  if (
    row.id === null ||
    row.city === null ||
    row.claim_status === null ||
    row.content_locale === null ||
    row.display_name === null ||
    row.latitude === null ||
    row.longitude === null ||
    row.match_reason === null ||
    row.primary_language === null ||
    row.province === null ||
    row.public_precision === null ||
    row.result_rank === null ||
    row.verification_status === null
  ) {
    return null;
  }

  return {
    city: row.city,
    claimStatus: row.claim_status,
    contentLocale: row.content_locale,
    description: row.description,
    displayName: row.display_name,
    distanceKm: row.distance_km,
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    matchReason: row.match_reason,
    primaryLanguage: row.primary_language,
    province: row.province,
    publicPrecision: row.public_precision,
    rank: row.result_rank,
    verificationStatus: row.verification_status
  };
}

export async function searchPublicAssociations(params: PublicAssociationSearchParams): Promise<PublicAssociationSearch> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('search_public_associations', {
    origin_label_value: params.originLabel,
    radius_km_value: params.radiusKm,
    search_query_value: params.query,
    ui_locale_value: params.uiLocale,
    user_latitude_value: params.userLatitude,
    user_longitude_value: params.userLongitude,
    verified_only_value: params.verifiedOnly
  });

  if (error || data === null) {
    return {
      ambiguousLocation: false,
      locationResolved: false,
      nearest: [],
      originLabel: null,
      results: [],
      totalResults: 0
    };
  }

  const parsedRows = (data as unknown[]).flatMap((row) => {
    const parsed = publicAssociationSearchRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  const meta = parsedRows[0];
  const results = parsedRows.filter((row) => row.row_type === 'result').map(toSearchResult).filter(isSearchResult);
  const nearest = parsedRows.filter((row) => row.row_type === 'nearest').map(toSearchResult).filter(isSearchResult);

  return {
    ambiguousLocation: meta?.ambiguous_location ?? false,
    locationResolved: meta?.location_resolved ?? false,
    nearest,
    originLabel: meta?.origin_label ?? null,
    results,
    totalResults: meta?.total_results ?? results.length
  };
}
