import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';

import { LeveeCreateForm } from '@/features/levees';
import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const associationSummarySchema = z.object({
  name: z.string()
});

const leveeCallRowSchema = z.object({
  amount_due_cents: z.number(),
  associations: z.union([associationSummarySchema, z.array(associationSummarySchema)]).nullable(),
  id: z.string().uuid(),
  share_count: z.number().int(),
  status: z.enum(['pending', 'in_progress', 'completed'])
});

const leveeRowSchema = z.object({
  association_levee_calls: z.array(leveeCallRowSchema).nullable(),
  created_at: z.string(),
  deadline: z.string(),
  deceased_city: z.string().nullable(),
  deceased_date_of_death: z.string().nullable(),
  deceased_full_name: z.string(),
  id: z.string().uuid(),
  per_share_amount_cents: z.number(),
  pool_size: z.number().int(),
  status: z.enum(['active', 'closed', 'cancelled']),
  target_amount_cents: z.number().int()
});

type AdminLeveesPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

type LeveeCallRow = z.infer<typeof leveeCallRowSchema>;
type LeveeRow = z.infer<typeof leveeRowSchema>;

function callAssociationName(call: LeveeCallRow): string | null {
  const association = Array.isArray(call.associations) ? call.associations[0] : call.associations;
  return association?.name ?? null;
}

async function currentPoolSize(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('current_total_share_count');

  if (error || typeof data !== 'number') {
    return 0;
  }

  return data;
}

async function listLevees(): Promise<LeveeRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('levees')
    .select('id,deceased_full_name,deceased_city,deceased_date_of_death,target_amount_cents,deadline,pool_size,per_share_amount_cents,status,created_at,association_levee_calls(id,share_count,amount_due_cents,status,associations:association_id(name))')
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = leveeRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export default async function AdminLeveesPage({ params }: AdminLeveesPageProps) {
  await requirePlatformAdmin();

  const t = await getTranslations('levees.admin');
  const format = await getFormatter();
  const poolSize = await currentPoolSize();
  const levees = await listLevees();

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/admin"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {t('backToAdmin')}
          </Link>
        </div>

        <dl className="grid gap-4 rounded-md border border-border bg-sunken p-5 md:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-secondary">{t('poolSizeLabel')}</dt>
            <dd className="mt-1 font-mono text-2xl text-heading">{poolSize}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-secondary">{t('poolScopeLabel')}</dt>
            <dd className="mt-1 text-sm leading-6 text-heading">{t('poolScopeValue')}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-secondary">{t('calculationLabel')}</dt>
            <dd className="mt-1 text-sm leading-6 text-heading">{t('calculationValue')}</dd>
          </div>
        </dl>

        <LeveeCreateForm locale={params.locale} />

        <section className="grid gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-heading">{t('listTitle')}</h2>
            <p className="text-sm leading-6 text-secondary">{t('listDescription')}</p>
          </div>

          {levees.length === 0 ? (
            <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('emptyState')}</div>
          ) : (
            <div className="grid gap-4">
              {levees.map((levee) => (
                <article className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card" key={levee.id}>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">{t(`statuses.${levee.status}`)}</p>
                      <h3 className="mt-1 text-xl font-semibold text-heading">{levee.deceased_full_name}</h3>
                      {levee.deceased_city === null ? null : <p className="mt-1 text-sm text-secondary">{levee.deceased_city}</p>}
                    </div>
                    <p className="rounded-sm bg-info-bg px-3 py-2 text-sm font-medium text-info">
                      {t('perShareValue', { amount: format.number(levee.per_share_amount_cents / 100, { currency: 'CAD', style: 'currency' }) })}
                    </p>
                  </div>
                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-4">
                    <div>
                      <dt className="font-medium text-secondary">{t('targetAmountLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.number(levee.target_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('snapshotPoolLabel')}</dt>
                      <dd className="mt-1 font-mono text-heading">{levee.pool_size}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('deadlineListLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.dateTime(new Date(levee.deadline), { dateStyle: 'medium' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('createdAtLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.dateTime(new Date(levee.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                    </div>                  </dl>
                  <section className="grid gap-3">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-base font-semibold text-heading">{t('callsTitle')}</h4>
                      <p className="text-sm leading-6 text-secondary">{t('callsDescription')}</p>
                    </div>
                    {levee.association_levee_calls === null || levee.association_levee_calls.length === 0 ? (
                      <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('callsEmpty')}</div>
                    ) : (
                      <div className="grid gap-3">
                        {levee.association_levee_calls.map((call) => (
                          <div className="grid gap-3 rounded-sm border border-border bg-card p-4 text-sm md:grid-cols-4" key={call.id}>
                            <div>
                              <p className="font-medium text-secondary">{t('callAssociationLabel')}</p>
                              <p className="mt-1 text-heading">{callAssociationName(call) ?? t('unknownAssociation')}</p>
                            </div>
                            <div>
                              <p className="font-medium text-secondary">{t('callSharesLabel')}</p>
                              <p className="mt-1 font-mono text-heading">{call.share_count}</p>
                            </div>
                            <div>
                              <p className="font-medium text-secondary">{t('callAmountLabel')}</p>
                              <p className="mt-1 text-heading">{format.number(call.amount_due_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                            </div>
                            <div>
                              <p className="font-medium text-secondary">{t('callStatusLabel')}</p>
                              <p className="mt-1 rounded-sm bg-warning-bg px-2 py-1 font-medium text-warning">{t(`callStatuses.${call.status}`)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
