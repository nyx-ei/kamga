import { getTranslations } from 'next-intl/server';
import { Bell, Building2, CheckCircle2, Crosshair, MapPin, Search } from 'lucide-react';
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

type HomePageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    q?: string;
  };
};

type AssociationCard = z.infer<typeof associationCardSchema>;

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

function distanceForIndex(index: number): string {
  return `${(0.4 + index * 0.8).toFixed(1)} km`;
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const t = await getTranslations('home');
  const query = searchQuery(searchParams.q);
  const displayQuery = query.length > 0 ? query : 'H2T 1S9 - Mile End, Montreal';
  const associations = await listAssociations(query);
  const hasResults = associations.length > 0;

  return (
    <main className="min-h-screen bg-page text-body">
      <PrototypeTopbar
        activeMode="lookup"
        tabs={[
          { active: hasResults, href: '/?q=Montreal', label: 'Search results' },
          { active: !hasResults, href: '/', label: 'Empty state' }
        ]}
      />
      <PublicDirectoryHeader locale={params.locale} />

      <section className="px-8 py-10">
        <form className="grid gap-5" method="get">
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
                  placeholder={displayQuery}
                  type="search"
                />
              </span>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-border bg-card px-5 text-sm font-semibold text-heading shadow-card transition hover:border-border-strong"
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
              <button className="rounded-sm border border-border bg-card px-4 py-2 text-sm text-heading shadow-card" type="button">
                Within 15 km x
              </button>
              <button className="rounded-sm border border-border bg-card px-4 py-2 text-sm text-heading shadow-card" type="button">
                French or English x
              </button>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-heading">
                <span className="size-5 rounded-sm border border-input bg-card" />
                Verified only
              </label>
            </div>
            <p className="text-sm text-secondary">
              <strong className="text-heading">{associations.length}</strong> associations near {query.length > 0 ? query : 'Mile End, Montreal, QC'}
            </p>
          </div>
        </form>

        {hasResults ? (
          <section className="mt-8 grid gap-8">
            <div className="flex flex-wrap items-center gap-6 rounded-md border border-dashed border-brand bg-[#f7f9ff] px-5 py-4">
              <span className="text-xs font-semibold uppercase text-[#3454b8]">Compare options</span>
              <span className="text-sm font-semibold text-secondary">Map layout</span>
              <button className="rounded-sm bg-card px-4 py-2 text-sm font-semibold text-heading shadow-card" type="button">
                Side-by-side
              </button>
              <button className="rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-secondary" type="button">
                List-first + toggle
              </button>
              <span className="text-sm font-semibold text-secondary">Result card</span>
              <button className="rounded-sm bg-card px-4 py-2 text-sm font-semibold text-heading shadow-card" type="button">
                Compact
              </button>
              <button className="rounded-sm bg-[#eef1f7] px-4 py-2 text-sm font-semibold text-secondary" type="button">
                Detailed
              </button>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
              <div className="grid content-start gap-4">
                {associations.map((association, index) => (
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
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full bg-positive-bg px-3 py-1 text-xs font-semibold text-positive">
                              <CheckCircle2 aria-hidden="true" size={14} />
                              Verified
                            </span>
                            <span className="rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">French & English</span>
                          </div>
                          <Link
                            className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong"
                            href={`/associations/${association.id}`}
                          >
                            <Building2 aria-hidden="true" size={16} />
                            Request to connect
                          </Link>
                        </div>
                      </div>
                      <p className="text-right text-xl font-semibold text-heading">
                        {distanceForIndex(index)}
                        <span className="block text-sm font-normal text-secondary">away</span>
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="relative min-h-[520px] overflow-hidden rounded-md border border-border bg-[#eef3fb] shadow-card">
                <div className="absolute inset-0 bg-[linear-gradient(#dfe6f3_1px,transparent_1px),linear-gradient(90deg,#dfe6f3_1px,transparent_1px)] bg-[size:56px_56px]" />
                {associations.slice(0, 5).map((association, index) => (
                  <span
                    className="absolute grid size-12 place-items-center rounded-full border-2 border-[#465fb7] bg-[#4d67c7] text-lg font-semibold text-white shadow-card"
                    key={association.id}
                    style={{ left: `${24 + ((index * 17) % 56)}%`, top: `${18 + ((index * 21) % 58)}%` }}
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-md border border-border bg-card p-12 shadow-card">
              <span className="grid size-16 place-items-center rounded-md bg-[#f1f4ff] text-[#3454b8]">
                <Search aria-hidden="true" size={34} />
              </span>
              <h2 className="mt-8 text-3xl font-semibold text-heading">No associations found near {query.length > 0 ? query : 'Trois-Rivieres'} yet</h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-secondary">
                The directory is still growing. If you know an RPN association in this area, help us add it - they will be invited to confirm their own listing.
              </p>
              <div className="mt-7 flex flex-wrap gap-4">
                <Link className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong" href="/register">
                  <Building2 aria-hidden="true" size={16} />
                  Ask them to register
                </Link>
                <button className="inline-flex items-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold text-brand" type="button">
                  <Bell aria-hidden="true" size={16} />
                  Notify me when one is listed
                </button>
              </div>
            </article>

            <aside className="rounded-md border border-border bg-card p-9 shadow-card">
              <h2 className="text-xs font-semibold uppercase text-muted">Nearest listed associations</h2>
              <div className="mt-5 grid gap-4">
                {['Association RPN Shawinigan', "Comite d'entraide Becancour"].map((name, index) => (
                  <div className="flex items-center justify-between rounded-sm border border-border bg-card px-5 py-4 shadow-card" key={name}>
                    <span className="inline-flex items-center gap-3 font-semibold text-heading">
                      <MapPin aria-hidden="true" className="text-secondary" size={18} />
                      {name}
                    </span>
                    <span className="font-mono text-secondary">{index === 0 ? '34.2 km' : '41.8 km'}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-6 text-secondary">Shown because nothing matched within 15 km of your search.</p>
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
