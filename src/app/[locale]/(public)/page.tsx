import { getTranslations } from 'next-intl/server';
import { Bell, Building2, Crosshair, MapPin, Search } from 'lucide-react';
import { z } from 'zod';

import { PrototypeTopbar, PublicDirectoryHeader } from '@/components/kamga/MockupShell';
import { Link } from '@/i18n/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const associationCardSchema = z.object({
  city: z.string(),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string()
});

const viewSchema = z.enum(['results', 'empty']).catch('empty');

type HomePageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    q?: string;
    view?: string;
  };
};

type AssociationCard = z.infer<typeof associationCardSchema>;

function searchQuery(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}

function selectedView(value: string | undefined): 'results' | 'empty' {
  return viewSchema.parse(value);
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
  const view = selectedView(searchParams.view);
  const associations = await listAssociations(query);
  const isResultsView = view === 'results';

  return (
    <main className="min-h-screen bg-page text-body">
      <PrototypeTopbar
        activeMode="lookup"
        tabs={[
          { active: isResultsView, href: '/?view=results', label: 'Search results' },
          { active: !isResultsView, href: '/?view=empty', label: 'Empty state' }
        ]}
      />
      <PublicDirectoryHeader locale={params.locale} />

      <section className="px-8 py-10">
        <form className="grid gap-5" method="get">
          <input name="view" type="hidden" value="results" />
          <label className="grid gap-2 text-sm font-semibold text-heading">
            Postal code, address, or city
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
                Use my location
              </button>
              <button className="inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-brand px-7 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong" type="submit">
                <Search aria-hidden="true" size={18} />
                Search
              </button>
            </span>
          </label>

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-heading">Filter</span>
              <button className="cursor-not-allowed rounded-sm border border-border bg-sunken px-4 py-2 text-sm text-muted shadow-card" disabled type="button">
                Distance filter
              </button>
              <button className="cursor-not-allowed rounded-sm border border-border bg-sunken px-4 py-2 text-sm text-muted shadow-card" disabled type="button">
                Language filter
              </button>
              <label className="inline-flex cursor-not-allowed items-center gap-2 text-sm font-medium text-muted">
                <input className="size-5" disabled type="checkbox" />
                Verified only
              </label>
            </div>
            <p className="text-sm text-secondary">
              <strong className="text-heading">{associations.length}</strong> {associations.length === 1 ? 'association' : 'associations'}
              {query.length > 0 ? ` matching "${query}"` : ''}
            </p>
          </div>
        </form>

        {isResultsView ? (
          <section className="mt-8 grid gap-8">
            <div className="flex flex-wrap items-center gap-6 rounded-md border border-dashed border-brand bg-[#f7f9ff] px-5 py-4">
              <span className="text-xs font-semibold uppercase text-[#3454b8]">Compare options</span>
              <span className="text-sm font-semibold text-secondary">Map layout</span>
              <button className="cursor-not-allowed rounded-sm bg-sunken px-4 py-2 text-sm font-semibold text-muted shadow-card" disabled type="button">
                Side-by-side
              </button>
              <button className="cursor-not-allowed rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-muted" disabled type="button">
                List-first + toggle
              </button>
              <span className="text-sm font-semibold text-secondary">Result card</span>
              <button className="cursor-not-allowed rounded-sm bg-sunken px-4 py-2 text-sm font-semibold text-muted shadow-card" disabled type="button">
                Compact
              </button>
              <button className="cursor-not-allowed rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-muted" disabled type="button">
                Detailed
              </button>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
              <div className="grid content-start gap-4">
                {associations.length === 0 ? (
                  <article className="rounded-md border border-border bg-card p-8 shadow-card">
                    <h2 className="text-2xl font-semibold text-heading">{t('emptyState')}</h2>
                    <p className="mt-3 text-sm leading-6 text-secondary">No active association record is available from the database for this search.</p>
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
                              Request to connect
                            </Link>
                          </div>
                        </div>
                        <p className="text-right text-sm font-semibold text-muted">
                          Distance
                          <span className="block font-normal">unavailable</span>
                        </p>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-md border border-border bg-[#eef3fb] shadow-card">
                <div className="absolute inset-0 bg-[linear-gradient(#dfe6f3_1px,transparent_1px),linear-gradient(90deg,#dfe6f3_1px,transparent_1px)] bg-[size:56px_56px]" />
                <div className="relative rounded-md border border-border bg-card/90 px-6 py-5 text-center shadow-card">
                  <p className="font-semibold text-heading">Map view unavailable</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-secondary">Association coordinates are not stored yet, so the map keeps the mockup frame without plotting fake markers.</p>
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
              <h2 className="mt-8 text-3xl font-semibold text-heading">{query.length > 0 ? `No associations found for "${query}" yet` : t('emptyState')}</h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-secondary">
                The directory is still growing. If you know an RPN association in this area, help us add it - they will be invited to confirm their own listing.
              </p>
              <div className="mt-7 flex flex-wrap gap-4">
                <Link className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong" href="/register">
                  <Building2 aria-hidden="true" size={16} />
                  Ask them to register
                </Link>
                <button className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold text-muted" disabled type="button">
                  <Bell aria-hidden="true" size={16} />
                  Notify me when one is listed
                </button>
              </div>
            </article>

            <aside className="rounded-md border border-border bg-card p-9 shadow-card">
              <h2 className="text-xs font-semibold uppercase text-muted">Nearest listed associations</h2>
              <div className="mt-5 rounded-sm border border-border bg-sunken px-5 py-6">
                <p className="text-sm leading-6 text-secondary">Nearest-association suggestions require geocoded association coordinates. This panel is intentionally empty until those fields exist.</p>
              </div>
              <p className="mt-6 text-sm leading-6 text-secondary">No fallback association data is fabricated from the mockups.</p>
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
