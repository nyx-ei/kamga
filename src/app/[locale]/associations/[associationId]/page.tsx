import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Building2, MapPin } from 'lucide-react';
import { z } from 'zod';

import { ASSOCIATION_STATUSES, type AssociationStatus } from '@/features/associations/association-types';
import { AssociationStatusBadge } from '@/features/associations/components/AssociationStatusBadge';
import { Link } from '@/i18n/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const publicAssociationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string(),
  status: z.enum(ASSOCIATION_STATUSES)
});

type AssociationProfilePageProps = {
  params: {
    associationId: string;
  };
};

async function getPublicAssociationProfile(associationId: string) {
  const parsedId = z.string().uuid().safeParse(associationId);

  if (!parsedId.success) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  // CV-SEC-06: public profile is shaped server-side and never selects private contact or proof fields.
  const { data, error } = await supabase
    .from('associations')
    .select('id,name,city,status')
    .eq('id', parsedId.data)
    .eq('status', 'active')
    .maybeSingle();

  if (error || data === null) {
    return null;
  }

  const parsed = publicAssociationSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export default async function AssociationProfilePage({ params }: AssociationProfilePageProps) {
  const association = await getPublicAssociationProfile(params.associationId);

  if (association === null) {
    notFound();
  }

  const t = await getTranslations('associations.profile');
  const statusT = await getTranslations('associations.status');

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto grid max-w-5xl gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <AssociationStatusBadge label={statusT(association.status)} status={association.status as AssociationStatus} />
            <h1 className="text-3xl font-semibold leading-tight text-heading">{association.name}</h1>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/"
          >
            <Building2 aria-hidden="true" size={16} />
            {t('directoryAction')}
          </Link>
        </div>

        <dl className="grid gap-4 rounded-md border border-border bg-sunken p-5 md:grid-cols-2">
          <div className="space-y-2">
            <dt className="text-sm font-medium text-secondary">{t('cityLabel')}</dt>
            <dd className="inline-flex items-center gap-2 text-heading">
              <MapPin aria-hidden="true" size={16} />
              {association.city}
            </dd>
          </div>
          <div className="space-y-2">
            <dt className="text-sm font-medium text-secondary">{t('contactLabel')}</dt>
            <dd className="text-sm leading-6 text-heading">{t('contactDescription')}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
