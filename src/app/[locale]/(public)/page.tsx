import { getTranslations } from 'next-intl/server';
import { Building2, MapPin, Search } from 'lucide-react';
import { z } from 'zod';

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

export default async function HomePage({ searchParams }: HomePageProps) {
  const t = await getTranslations('home');
  const query = searchQuery(searchParams.q);
  const associations = await listAssociations(query);

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
            <p className="text-base leading-7 text-secondary">{t('description')}</p>
          </div>
        </div>

        <form className="grid gap-3 rounded-md border border-border bg-sunken p-5 md:grid-cols-[1fr_auto]" method="get">
          <label className="grid gap-2 text-sm font-medium text-heading">
            {t('searchLabel')}
            <input
              className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition focus:border-focus"
              defaultValue={query}
              maxLength={80}
              name="q"
              placeholder={t('searchPlaceholder')}
              type="search"
            />
          </label>
          <button className="inline-flex h-fit items-center gap-2 self-end rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong" type="submit">
            <Search aria-hidden="true" size={16} />
            {t('primaryAction')}
          </button>
        </form>

        <section className="grid gap-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-xl font-semibold text-heading">{t('directoryTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{t('directoryDescription')}</p>
            </div>
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
              href="/register"
            >
              <Building2 aria-hidden="true" size={16} />
              {t('secondaryAction')}
            </Link>
          </div>

          {associations.length === 0 ? (
            <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('emptyState')}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {associations.map((association) => (
                <article className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card" key={association.id}>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-heading">{association.name}</h3>
                    <p className="inline-flex items-center gap-2 text-sm text-secondary">
                      <MapPin aria-hidden="true" size={15} />
                      {association.city}
                    </p>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-secondary">{association.description ?? t('descriptionFallback')}</p>
                  <Link
                    className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
                    href={`/associations/${association.id}`}
                  >
                    {t('viewAssociationAction')}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
