import { getTranslations } from 'next-intl/server';
import { Bell, Building2, Crosshair, MapPin, Search } from 'lucide-react';
import { z } from 'zod';

import { PublicDirectoryHeader } from '@/components/kamga/MockupShell';
import { Link } from '@/i18n/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const associationCardSchema = z.object({
  city: z.string(),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string()
});

type HomePageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    q?: string;
  };
};

type AssociationCard = z.infer<typeof associationCardSchema>;

const directoryCopy = {
  en: {
    searchLabel: 'Postal code, address, or city',
    useLocation: 'Use my location',
    search: 'Search',
    filter: 'Filter',
    distanceFilter: 'Distance filter',
    languageFilter: 'Language filter',
    verifiedOnly: 'Verified only',
    associationSingular: 'association',
    associationPlural: 'associations',
    matching: (query: string) => ` matching "${query}"`,
    compareOptions: 'Compare options',
    mapLayout: 'Map layout',
    sideBySide: 'Side-by-side',
    listFirst: 'List-first + toggle',
    resultCard: 'Result card',
    compact: 'Compact',
    detailed: 'Detailed',
    noDatabaseResults: 'No active association record is available from the database for this search.',
    requestToConnect: 'Request to connect',
    distance: 'Distance',
    unavailable: 'unavailable',
    mapUnavailable: 'Map view unavailable',
    mapUnavailableDescription: 'Association coordinates are not stored yet, so the map keeps the approved layout without plotting fake markers.',
    noResults: (query: string) => `No associations found for "${query}" yet`,
    emptyDescription:
      'The directory is still growing. If you know an RPN association in this area, help us add it - they will be invited to confirm their own listing.',
    askRegister: 'Ask them to register',
    notify: 'Notify me when one is listed',
    nearest: 'Nearest listed associations',
    nearestUnavailable: 'Nearest-association suggestions require geocoded association coordinates. This panel is intentionally empty until those fields exist.',
    noMockData: 'No fallback association data is fabricated from the mockups.'
  },
  fr: {
    searchLabel: 'Code postal, adresse ou ville',
    useLocation: 'Utiliser ma position',
    search: 'Rechercher',
    filter: 'Filtrer',
    distanceFilter: 'Filtre de distance',
    languageFilter: 'Filtre de langue',
    verifiedOnly: 'Verifiees uniquement',
    associationSingular: 'association',
    associationPlural: 'associations',
    matching: (query: string) => ` correspondant a "${query}"`,
    compareOptions: 'Comparer les options',
    mapLayout: 'Disposition de la carte',
    sideBySide: 'Cote a cote',
    listFirst: "Liste d'abord + bascule",
    resultCard: 'Carte de resultat',
    compact: 'Compact',
    detailed: 'Detaille',
    noDatabaseResults: 'Aucune association active en base ne correspond a cette recherche.',
    requestToConnect: 'Demander a se connecter',
    distance: 'Distance',
    unavailable: 'indisponible',
    mapUnavailable: 'Carte indisponible',
    mapUnavailableDescription: "Les coordonnees des associations ne sont pas encore stockees, donc la carte conserve le layout valide sans afficher de marqueurs fictifs.",
    noResults: (query: string) => `Aucune association trouvee pour "${query}"`,
    emptyDescription:
      "L'annuaire continue de grandir. Si vous connaissez une association RPN dans cette zone, aidez-nous a l'ajouter - elle sera invitee a confirmer sa propre fiche.",
    askRegister: "L'inviter a s'inscrire",
    notify: "Me notifier lorsqu'une association est ajoutee",
    nearest: 'Associations referencees les plus proches',
    nearestUnavailable: "Les suggestions d'associations proches demandent des coordonnees geocodees. Ce panneau reste vide jusqu'a l'ajout de ces champs.",
    noMockData: "Aucune donnee de secours n'est fabriquee depuis les maquettes."
  }
} as const;

function searchQuery(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

async function listAssociations(query: string): Promise<AssociationCard[]> {
  const supabase = createSupabaseAdminClient();
  let request = supabase.from('associations').select('id,name,city,description').eq('status', 'active').order('name', { ascending: true }).limit(30);

  if (query.length > 0) {
    const pattern = `%${query.replaceAll('%', '').replaceAll('_', '')}%`;
    request = request.or(`name.ilike.${pattern},city.ilike.${pattern}`);
  }

  const { data, error } = await request;

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = associationCardSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const t = await getTranslations('home');
  const query = searchQuery(searchParams.q);
  const associations = await listAssociations(query);
  const hasDirectoryResults = associations.length > 0;
  const copy = directoryCopy[params.locale];

  return (
    <main className="min-h-screen bg-page text-body">
      <PublicDirectoryHeader locale={params.locale} />

      <section className="px-8 py-10">
        <form className="grid gap-5" method="get">
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
              <button className="cursor-not-allowed rounded-sm border border-border bg-sunken px-4 py-2 text-sm text-muted shadow-card" disabled type="button">
                {copy.distanceFilter}
              </button>
              <button className="cursor-not-allowed rounded-sm border border-border bg-sunken px-4 py-2 text-sm text-muted shadow-card" disabled type="button">
                {copy.languageFilter}
              </button>
              <label className="inline-flex cursor-not-allowed items-center gap-2 text-sm font-medium text-muted">
                <input className="size-5" disabled type="checkbox" />
                {copy.verifiedOnly}
              </label>
            </div>
            <p className="text-sm text-secondary">
              <strong className="text-heading">{associations.length}</strong> {associations.length === 1 ? copy.associationSingular : copy.associationPlural}
              {query.length > 0 ? copy.matching(query) : ''}
            </p>
          </div>
        </form>

        {hasDirectoryResults ? (
          <section className="mt-8 grid gap-8">
            <div className="flex flex-wrap items-center gap-6 rounded-md border border-dashed border-brand bg-[#f7f9ff] px-5 py-4">
              <span className="text-xs font-semibold uppercase text-[#3454b8]">{copy.compareOptions}</span>
              <span className="text-sm font-semibold text-secondary">{copy.mapLayout}</span>
              <button className="cursor-not-allowed rounded-sm bg-sunken px-4 py-2 text-sm font-semibold text-muted shadow-card" disabled type="button">
                {copy.sideBySide}
              </button>
              <button className="cursor-not-allowed rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-muted" disabled type="button">
                {copy.listFirst}
              </button>
              <span className="text-sm font-semibold text-secondary">{copy.resultCard}</span>
              <button className="cursor-not-allowed rounded-sm bg-sunken px-4 py-2 text-sm font-semibold text-muted shadow-card" disabled type="button">
                {copy.compact}
              </button>
              <button className="cursor-not-allowed rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-muted" disabled type="button">
                {copy.detailed}
              </button>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
              <div className="grid content-start gap-4">
                {associations.length === 0 ? (
                  <article className="rounded-md border border-border bg-card p-8 shadow-card">
                    <h2 className="text-2xl font-semibold text-heading">{t('emptyState')}</h2>
                    <p className="mt-3 text-sm leading-6 text-secondary">{copy.noDatabaseResults}</p>
                  </article>
                ) : (
                  associations.map((association, index) => (
                    <article className="grid rounded-md border border-border bg-card p-5 shadow-card" key={association.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-5">
                          <span className="grid size-10 place-items-center rounded-full bg-[#4d67c7] text-sm font-semibold text-white shadow-card">{index + 1}</span>
                          <div className="space-y-3">
                            <div>
                              <h2 className="text-xl font-semibold text-heading">{association.name}</h2>
                              <p className="mt-1 inline-flex items-center gap-2 text-sm text-secondary">
                                <MapPin aria-hidden="true" size={16} />
                                {association.city}
                              </p>
                            </div>
                            <p className="line-clamp-2 max-w-2xl text-sm leading-6 text-secondary">{association.description ?? t('descriptionFallback')}</p>
                            <Link
                              className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong"
                              href={`/associations/${association.id}`}
                            >
                              <Building2 aria-hidden="true" size={16} />
                              {copy.requestToConnect}
                            </Link>
                          </div>
                        </div>
                        <p className="text-right text-sm font-semibold text-muted">
                          {copy.distance}
                          <span className="block font-normal">{copy.unavailable}</span>
                        </p>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-md border border-border bg-[#eef3fb] shadow-card">
                <div className="absolute inset-0 bg-[linear-gradient(#dfe6f3_1px,transparent_1px),linear-gradient(90deg,#dfe6f3_1px,transparent_1px)] bg-[size:56px_56px]" />
                <div className="relative rounded-md border border-border bg-card/90 px-6 py-5 text-center shadow-card">
                  <p className="font-semibold text-heading">{copy.mapUnavailable}</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-secondary">{copy.mapUnavailableDescription}</p>
                </div>
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
              <div className="mt-5 rounded-sm border border-border bg-sunken px-5 py-6">
                <p className="text-sm leading-6 text-secondary">{copy.nearestUnavailable}</p>
              </div>
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
