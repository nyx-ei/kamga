import { getTranslations } from 'next-intl/server';
import { Bell, Building2, Crosshair, Flag, MapPin, Search, ShieldCheck } from 'lucide-react';
import { z } from 'zod';

import { PublicDirectoryHeader } from '@/components/kamga/MockupShell';
import { ASSOCIATION_CLAIM_STATUSES, ASSOCIATION_PRIMARY_LANGUAGES, ASSOCIATION_VERIFICATION_STATUSES } from '@/features/associations/association-types';
import { Link } from '@/i18n/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DEFAULT_RADIUS_KM = 10;
const WIDER_RADIUS_KM = 25;
const MAX_RADIUS_KM = 50;
const PAGE_SIZE = 10;
const EARTH_RADIUS_KM = 6371;

const associationCardSchema = z.object({
  aliases: z.array(z.string()).nullable(),
  claim_status: z.enum(ASSOCIATION_CLAIM_STATUSES),
  city: z.string(),
  description: z.string().nullable(),
  display_name: z.string(),
  id: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  primary_language: z.enum(ASSOCIATION_PRIMARY_LANGUAGES),
  province: z.string(),
  public_precision: z.enum(['exact', 'neighbourhood']),
  verification_status: z.enum(ASSOCIATION_VERIFICATION_STATUSES)
});

type HomePageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    page?: string;
    q?: string;
    radius?: string;
    verified?: string;
  };
};

type AssociationCard = z.infer<typeof associationCardSchema>;
type MatchReason = 'identity' | 'location';
type RankedAssociation = AssociationCard & {
  distanceKm: number | null;
  matchReason: MatchReason;
};
type SearchOrigin = {
  label: string;
  latitude: number;
  longitude: number;
};

const directoryCopy = {
  en: {
    searchLabel: 'Postal code, address, or city',
    useLocation: 'Use my location',
    search: 'Search',
    filter: 'Filter',
    distanceFilter: (radius: number) => `Within ${radius} km`,
    languageFilter: 'French or English',
    verifiedOnly: 'Verified only',
    associationSingular: 'association',
    associationPlural: 'associations',
    near: (origin: string) => ` near ${origin}`,
    matching: (query: string) => ` matching "${query}"`,
    searchWider: 'Search wider',
    compareOptions: 'Compare options',
    mapLayout: 'Map layout',
    sideBySide: 'Side-by-side',
    listFirst: 'List-first + toggle',
    resultCard: 'Result card',
    compact: 'Compact',
    detailed: 'Detailed',
    noDatabaseResults: 'No active geocoded association record is available from the database for this search.',
    requestToConnect: 'Request to connect',
    claimAction: 'Is this your association? Claim it',
    nameMatch: 'Name match',
    verified: 'Verified',
    languages: { en: 'English', fr: 'French', fr_en: 'French & English' },
    distanceAway: (distance: number) => `${distance.toFixed(1)} km away`,
    mapTitle: 'Approximate directory map',
    mapPrecision: 'Approximate - respects public precision',
    locationOnlyMap: 'Only location-band matches are plotted. Name matches stay in the list.',
    pagination: (current: number, total: number) => `Page ${current} of ${total}`,
    previous: 'Previous',
    next: 'Next',
    noResults: (query: string) => `No associations found for "${query}" yet`,
    emptyDescription:
      'The directory is still growing. If you know an RPN association in this area, help us add it - they will be invited to confirm their own listing.',
    askRegister: 'Ask them to register',
    notify: 'Notify me when one is listed',
    nearest: 'Nearest listed associations',
    nearestDescription: 'Shown because nothing matched inside the current search radius.',
    noMockData: 'No fallback association data is fabricated from the mockups.'
  },
  fr: {
    searchLabel: 'Code postal, adresse ou ville',
    useLocation: 'Utiliser ma position',
    search: 'Rechercher',
    filter: 'Filtrer',
    distanceFilter: (radius: number) => `Dans un rayon de ${radius} km`,
    languageFilter: 'Français ou anglais',
    verifiedOnly: 'Vérifiées uniquement',
    associationSingular: 'association',
    associationPlural: 'associations',
    near: (origin: string) => ` près de ${origin}`,
    matching: (query: string) => ` correspondant à "${query}"`,
    searchWider: 'Élargir la recherche',
    compareOptions: 'Comparer les options',
    mapLayout: 'Disposition de la carte',
    sideBySide: 'Côte à côte',
    listFirst: 'Liste d’abord + bascule',
    resultCard: 'Carte de résultat',
    compact: 'Compact',
    detailed: 'Détaillé',
    noDatabaseResults: 'Aucune fiche association active et géocodée ne correspond à cette recherche.',
    requestToConnect: 'Demander à être mis en relation',
    claimAction: 'C’est votre association ? Revendiquez-la',
    nameMatch: 'Nom correspondant',
    verified: 'Vérifiée',
    languages: { en: 'Anglais', fr: 'Français', fr_en: 'Français et anglais' },
    distanceAway: (distance: number) => `${distance.toFixed(1)} km`,
    mapTitle: 'Carte approximative de l’annuaire',
    mapPrecision: 'Approximation - respecte la précision publique',
    locationOnlyMap: 'Seuls les résultats de localisation sont affichés sur la carte. Les résultats par nom restent dans la liste.',
    pagination: (current: number, total: number) => `Page ${current} sur ${total}`,
    previous: 'Précédent',
    next: 'Suivant',
    noResults: (query: string) => `Aucune association trouvée pour "${query}"`,
    emptyDescription:
      'L’annuaire continue de grandir. Si vous connaissez une association RPN dans cette zone, aidez-nous à l’ajouter ; elle sera invitée à confirmer sa propre fiche.',
    askRegister: 'L’inviter à s’inscrire',
    notify: 'Me notifier lorsqu’une association est ajoutée',
    nearest: 'Associations référencées les plus proches',
    nearestDescription: 'Affichées parce qu’aucun résultat ne correspond au rayon actuel.',
    noMockData: 'Aucune donnée de secours n’est fabriquée depuis les maquettes.'
  }
} as const;

function searchQuery(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

function numericQuery(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim()
    .toLowerCase();
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(from: SearchOrigin, association: AssociationCard): number {
  const deltaLat = radians(association.latitude - from.latitude);
  const deltaLon = radians(association.longitude - from.longitude);
  const startLat = radians(from.latitude);
  const endLat = radians(association.latitude);
  const haversine = Math.sin(deltaLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function identityScore(association: AssociationCard, normalizedQuery: string): number {
  if (normalizedQuery.length === 0) {
    return 0;
  }

  const names = [association.display_name, ...(association.aliases ?? [])].map(normalize);
  if (names.some((name) => name === normalizedQuery)) {
    return 100;
  }

  if (names.some((name) => name.startsWith(normalizedQuery))) {
    return 80;
  }

  return names.some((name) => name.includes(normalizedQuery)) ? 60 : 0;
}

function resolveOrigin(query: string, associations: AssociationCard[]): SearchOrigin | null {
  const normalizedQuery = normalize(query);

  if (normalizedQuery.length === 0) {
    return null;
  }

  const exactCityMatches = associations.filter((association) => normalize(association.city) === normalizedQuery);
  const prefixPostalMatches = associations.filter((association) => normalize(`${association.city} ${association.province}`).includes(normalizedQuery));
  const matches = exactCityMatches.length > 0 ? exactCityMatches : prefixPostalMatches;

  if (matches.length === 0) {
    return null;
  }

  return {
    label: exactCityMatches.length > 0 ? matches[0]?.city ?? query : query,
    latitude: matches.reduce((sum, association) => sum + association.latitude, 0) / matches.length,
    longitude: matches.reduce((sum, association) => sum + association.longitude, 0) / matches.length
  };
}

function rankAssociations(associations: AssociationCard[], query: string, radius: number, verifiedOnly: boolean) {
  const normalizedQuery = normalize(query);
  const origin = resolveOrigin(query, associations);
  const rankedById = new Map<string, RankedAssociation>();

  if (normalizedQuery.length === 0) {
    const defaultRanked = associations
      .filter((association) => !verifiedOnly || association.verification_status === 'verified')
      .map((association) => ({ ...association, distanceKm: null, matchReason: 'identity' as const }))
      .sort((left, right) => {
        if (left.verification_status !== right.verification_status) {
          return left.verification_status === 'verified' ? -1 : 1;
        }

        return left.display_name.localeCompare(right.display_name);
      });

    return { locationBand: [], nearest: [], origin: null, ranked: defaultRanked };
  }

  for (const association of associations) {
    if (verifiedOnly && association.verification_status !== 'verified') {
      continue;
    }

    const score = identityScore(association, normalizedQuery);
    if (score > 0) {
      rankedById.set(association.id, { ...association, distanceKm: null, matchReason: 'identity' });
    }
  }

  if (origin !== null) {
    for (const association of associations) {
      if (verifiedOnly && association.verification_status !== 'verified') {
        continue;
      }

      const distance = distanceKm(origin, association);
      if (distance <= radius && !rankedById.has(association.id)) {
        rankedById.set(association.id, { ...association, distanceKm: distance, matchReason: 'location' });
      }
    }
  }

  const ranked = [...rankedById.values()].sort((left, right) => {
    if (left.matchReason !== right.matchReason) {
      return left.matchReason === 'identity' ? -1 : 1;
    }

    if (left.matchReason === 'location' && right.matchReason === 'location') {
      const distanceDelta = (left.distanceKm ?? 0) - (right.distanceKm ?? 0);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }
    }

    if (left.verification_status !== right.verification_status) {
      return left.verification_status === 'verified' ? -1 : 1;
    }

    return left.display_name.localeCompare(right.display_name);
  });

  const locationBand = ranked.filter((association) => association.matchReason === 'location');
  const nearest = origin === null
    ? []
    : associations
        .filter((association) => !rankedById.has(association.id))
        .map((association) => ({ ...association, distanceKm: distanceKm(origin, association), matchReason: 'location' as const }))
        .sort((left, right) => (left.distanceKm ?? 0) - (right.distanceKm ?? 0))
        .slice(0, 3);

  return { locationBand, nearest, origin, ranked };
}

async function listAssociations(): Promise<AssociationCard[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('public_association_directory')
    .select('id,display_name,city,province,description,primary_language,verification_status,claim_status,public_precision,latitude,longitude')
    .eq('geocode_status', 'geocoded')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('display_name', { ascending: true })
    .limit(250);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    if (typeof row !== 'object' || row === null) {
      return [];
    }

    const parsed = associationCardSchema.safeParse({ ...row, aliases: [] });
    return parsed.success ? [parsed.data] : [];
  });
}

function markerPosition(association: RankedAssociation, associations: RankedAssociation[]) {
  const latitudes = associations.map((item) => item.latitude);
  const longitudes = associations.map((item) => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const top = maxLat === minLat ? 50 : 12 + ((maxLat - association.latitude) / (maxLat - minLat)) * 76;
  const left = maxLon === minLon ? 50 : 12 + ((association.longitude - minLon) / (maxLon - minLon)) * 76;

  return { left: `${left}%`, top: `${top}%` };
}

function pageHref(query: string, radius: number, verifiedOnly: boolean, page: number) {
  return { pathname: '/', query: { ...(query.length > 0 ? { q: query } : {}), page: String(page), radius: String(radius), ...(verifiedOnly ? { verified: '1' } : {}) } };
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const t = await getTranslations('home');
  const query = searchQuery(searchParams.q);
  const radius = Math.min(numericQuery(searchParams.radius, DEFAULT_RADIUS_KM), MAX_RADIUS_KM);
  const currentPage = numericQuery(searchParams.page, 1);
  const verifiedOnly = searchParams.verified === '1';
  const associations = await listAssociations();
  const { locationBand, nearest, origin, ranked } = rankAssociations(associations, query, radius, verifiedOnly);
  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const paginatedAssociations = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasDirectoryResults = ranked.length > 0;
  const canSearchWider = origin !== null && locationBand.length < 3 && radius < MAX_RADIUS_KM;
  const mapAssociations = locationBand;
  const copy = directoryCopy[params.locale];

  return (
    <main className="min-h-screen bg-page text-body">
      <PublicDirectoryHeader locale={params.locale} />

      <section className="px-8 py-10">
        <form className="grid gap-5" method="get">
          <input name="radius" type="hidden" value={radius} />
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.searchLabel}
            <span className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
              <span className="relative block">
                <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={20} />
                <input
                  className="h-12 w-full rounded-sm border border-input bg-card pl-12 pr-4 text-base text-body shadow-card transition placeholder:text-secondary focus:border-focus focus:outline-none"
                  defaultValue={query}
                  maxLength={80}
                  name="q"
                  placeholder={t('searchPlaceholder')}
                  type="search"
                />
              </span>
              <button
                className="inline-flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-sm border border-border bg-sunken px-5 text-sm font-semibold text-muted shadow-card"
                disabled
                type="button"
              >
                <Crosshair aria-hidden="true" size={18} />
                {copy.useLocation}
              </button>
              <button className="inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-brand px-7 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong" type="submit">
                <Search aria-hidden="true" size={18} />
                {copy.search}
              </button>
            </span>
          </label>

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-heading">{copy.filter}</span>
              <span className="rounded-sm border border-border bg-card px-4 py-2 text-sm text-heading shadow-card">{copy.distanceFilter(radius)}</span>
              <button className="cursor-not-allowed rounded-sm border border-border bg-sunken px-4 py-2 text-sm text-muted shadow-card" disabled type="button">
                {copy.languageFilter}
              </button>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-heading">
                <input defaultChecked={verifiedOnly} name="verified" type="checkbox" value="1" />
                {copy.verifiedOnly}
              </label>
              {canSearchWider ? (
                <Link className="rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-brand shadow-card" href={pageHref(query, Math.min(radius === DEFAULT_RADIUS_KM ? WIDER_RADIUS_KM : MAX_RADIUS_KM, MAX_RADIUS_KM), verifiedOnly, 1)}>
                  {copy.searchWider}
                </Link>
              ) : null}
            </div>
            <p className="text-sm text-secondary">
              <strong className="text-heading">{ranked.length}</strong> {ranked.length === 1 ? copy.associationSingular : copy.associationPlural}
              {origin !== null ? copy.near(origin.label) : query.length > 0 ? copy.matching(query) : ''}
            </p>
          </div>
        </form>

        {hasDirectoryResults ? (
          <section className="mt-8 grid gap-8">
            <div className="flex flex-wrap items-center gap-6 rounded-md border border-dashed border-brand bg-[#f7f9ff] px-5 py-4">
              <span className="text-xs font-semibold uppercase text-[#3454b8]">{copy.compareOptions}</span>
              <span className="text-sm font-semibold text-secondary">{copy.mapLayout}</span>
              <span className="rounded-sm bg-sunken px-4 py-2 text-sm font-semibold text-heading shadow-card">{copy.sideBySide}</span>
              <button className="cursor-not-allowed rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-muted" disabled type="button">
                {copy.listFirst}
              </button>
              <span className="text-sm font-semibold text-secondary">{copy.resultCard}</span>
              <span className="rounded-sm bg-sunken px-4 py-2 text-sm font-semibold text-heading shadow-card">{copy.compact}</span>
              <button className="cursor-not-allowed rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-muted" disabled type="button">
                {copy.detailed}
              </button>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
              <div className="grid content-start gap-4">
                {paginatedAssociations.map((association, index) => {
                  const absoluteIndex = (page - 1) * PAGE_SIZE + index + 1;

                  return (
                    <article className="grid rounded-md border border-border bg-card p-5 shadow-card" key={association.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-5">
                          <span className="grid size-10 place-items-center rounded-full bg-[#4d67c7] text-sm font-semibold text-white shadow-card">{absoluteIndex}</span>
                          <div className="space-y-3">
                            <div>
                              <h2 className="text-xl font-semibold text-heading">{association.display_name}</h2>
                              <p className="mt-1 inline-flex items-center gap-2 text-sm text-secondary">
                                <MapPin aria-hidden="true" size={16} />
                                {association.city}, {association.province}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {association.matchReason === 'identity' && query.length > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1f7] px-3 py-1 text-xs font-semibold text-secondary">{copy.nameMatch}</span>
                              ) : association.distanceKm !== null ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1f7] px-3 py-1 text-xs font-semibold text-secondary">{copy.distanceAway(association.distanceKm)}</span>
                              ) : null}
                              {association.verification_status === 'verified' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-positive-bg px-3 py-1 text-xs font-semibold text-positive">
                                  <ShieldCheck aria-hidden="true" size={13} />
                                  {copy.verified}
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">
                                <Flag aria-hidden="true" size={13} />
                                {copy.languages[association.primary_language]}
                              </span>
                            </div>
                            <p className="line-clamp-2 max-w-2xl text-sm leading-6 text-secondary">{association.description ?? t('descriptionFallback')}</p>
                            <div className="flex flex-wrap gap-3">
                              <Link
                                className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong"
                                href={`/associations/${association.id}`}
                              >
                                <Building2 aria-hidden="true" size={16} />
                                {copy.requestToConnect}
                              </Link>
                              {association.claim_status === 'unclaimed' ? (
                                <Link className="inline-flex w-fit items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold text-brand" href={{ pathname: '/register', query: { claim: association.id } }}>
                                  <ShieldCheck aria-hidden="true" size={16} />
                                  {copy.claimAction}
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {totalPages > 1 ? (
                  <nav className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm shadow-card" aria-label="Pagination">
                    <p className="font-medium text-secondary">{copy.pagination(page, totalPages)}</p>
                    <div className="flex gap-2">
                      <Link className={`rounded-sm border border-border px-4 py-2 font-semibold shadow-card ${page === 1 ? 'pointer-events-none text-muted' : 'text-heading'}`} href={pageHref(query, radius, verifiedOnly, Math.max(1, page - 1))}>
                        {copy.previous}
                      </Link>
                      <Link className={`rounded-sm border border-border px-4 py-2 font-semibold shadow-card ${page === totalPages ? 'pointer-events-none text-muted' : 'text-heading'}`} href={pageHref(query, radius, verifiedOnly, Math.min(totalPages, page + 1))}>
                        {copy.next}
                      </Link>
                    </div>
                  </nav>
                ) : null}
              </div>

              <div className="relative min-h-[520px] overflow-hidden rounded-md border border-border bg-[#eef3fb] shadow-card">
                <div className="absolute inset-0 bg-[linear-gradient(#dfe6f3_1px,transparent_1px),linear-gradient(90deg,#dfe6f3_1px,transparent_1px)] bg-[size:56px_56px]" />
                <div className="absolute left-5 top-5 z-10 rounded-sm border border-border bg-card/95 px-4 py-3 shadow-card">
                  <p className="font-semibold text-heading">{copy.mapTitle}</p>
                  <p className="mt-1 text-xs text-secondary">{copy.locationOnlyMap}</p>
                </div>
                {mapAssociations.length === 0 ? (
                  <div className="relative grid h-full min-h-[520px] place-items-center p-8 text-center">
                    <p className="rounded-md border border-border bg-card/95 px-5 py-4 text-sm leading-6 text-secondary shadow-card">{copy.locationOnlyMap}</p>
                  </div>
                ) : (
                  mapAssociations.map((association, index) => (
                    <Link
                      aria-label={association.display_name}
                      className="absolute z-20 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#314ca8] bg-[#4d67c7] text-sm font-semibold text-white shadow-card transition hover:scale-105"
                      href={`/associations/${association.id}`}
                      key={association.id}
                      style={markerPosition(association, mapAssociations)}
                    >
                      {index + 1}
                    </Link>
                  ))
                )}
                <p className="absolute bottom-4 right-4 rounded-sm bg-card/95 px-3 py-2 text-xs text-secondary shadow-card">{copy.mapPrecision}</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-md border border-border bg-card p-12 shadow-card">
              <span className="grid size-16 place-items-center rounded-md bg-[#f1f4ff] text-[#3454b8]">
                <Search aria-hidden="true" size={34} />
              </span>
              <h2 className="mt-8 text-3xl font-semibold text-heading">{query.length > 0 ? copy.noResults(query) : t('emptyState')}</h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-secondary">{copy.emptyDescription}</p>
              <div className="mt-7 flex flex-wrap gap-4">
                <Link className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong" href="/register">
                  <Building2 aria-hidden="true" size={16} />
                  {copy.askRegister}
                </Link>
                <button className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold text-muted" disabled type="button">
                  <Bell aria-hidden="true" size={16} />
                  {copy.notify}
                </button>
              </div>
            </article>

            <aside className="rounded-md border border-border bg-card p-9 shadow-card">
              <h2 className="text-xs font-semibold uppercase text-muted">{copy.nearest}</h2>
              {nearest.length === 0 ? (
                <div className="mt-5 rounded-sm border border-border bg-sunken px-5 py-6">
                  <p className="text-sm leading-6 text-secondary">{copy.noDatabaseResults}</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {nearest.map((association) => (
                    <Link className="rounded-sm border border-border bg-sunken px-4 py-3 text-sm font-semibold text-heading" href={`/associations/${association.id}`} key={association.id}>
                      {association.display_name}
                      <span className="block font-normal text-secondary">{association.distanceKm === null ? association.city : copy.distanceAway(association.distanceKm)}</span>
                    </Link>
                  ))}
                  <p className="text-sm leading-6 text-secondary">{copy.nearestDescription}</p>
                </div>
              )}
              <p className="mt-6 text-sm leading-6 text-secondary">{copy.noMockData}</p>
            </aside>
          </section>
        )}

        <p className="sr-only" id="directory-about">
          {t('description')}
        </p>
      </section>
    </main>
  );
}