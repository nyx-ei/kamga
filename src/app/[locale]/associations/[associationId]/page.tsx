import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Building2, Languages, MapPin, ShieldCheck } from 'lucide-react';
import { z } from 'zod';

import { RequestToConnectAssociationForm } from '@/features/associations';
import { ASSOCIATION_CLAIM_STATUSES, ASSOCIATION_PRIMARY_LANGUAGES, ASSOCIATION_VERIFICATION_STATUSES } from '@/features/associations/association-types';
import { Link } from '@/i18n/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const publicAssociationSchema = z.object({
  claim_status: z.enum(ASSOCIATION_CLAIM_STATUSES),
  city: z.string(),
  description: z.string().nullable(),
  display_name: z.string(),
  id: z.string().uuid(),
  primary_language: z.enum(ASSOCIATION_PRIMARY_LANGUAGES),
  province: z.string(),
  public_street_address: z.string().nullable(),
  verification_status: z.enum(ASSOCIATION_VERIFICATION_STATUSES)
});

type AssociationProfilePageProps = {
  params: {
    associationId: string;
    locale: 'en' | 'fr';
  };
};

async function getPublicAssociationProfile(associationId: string) {
  const parsedId = z.string().uuid().safeParse(associationId);

  if (!parsedId.success) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  // CV-SEC-06 / BR-PE-02: public profile is shaped from the privacy-safe public directory view.
  const { data, error } = await supabase
    .from('public_association_directory')
    .select('id,display_name,city,province,description,primary_language,verification_status,claim_status,public_street_address')
    .eq('id', parsedId.data)
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

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto grid max-w-5xl gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            {association.verification_status === 'verified' ? (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-positive-bg px-3 py-1 text-xs font-semibold text-positive">
                <ShieldCheck aria-hidden="true" size={14} />
                {t('verifiedBadge')}
              </span>
            ) : null}
            <h1 className="text-3xl font-semibold leading-tight text-heading">{association.display_name}</h1>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/"
          >
            <Building2 aria-hidden="true" size={16} />
            {t('directoryAction')}
          </Link>
        </div>

        <p className="max-w-3xl text-base leading-7 text-secondary">{association.description ?? t('descriptionFallback')}</p>

        <dl className="grid gap-4 rounded-md border border-border bg-sunken p-5 md:grid-cols-3">
          <div className="space-y-2">
            <dt className="text-sm font-medium text-secondary">{t('locationLabel')}</dt>
            <dd className="inline-flex items-center gap-2 text-heading">
              <MapPin aria-hidden="true" size={16} />
              {association.public_street_address ?? `${association.city}, ${association.province}`}
            </dd>
          </div>
          <div className="space-y-2">
            <dt className="text-sm font-medium text-secondary">{t('languageLabel')}</dt>
            <dd className="inline-flex items-center gap-2 text-heading">
              <Languages aria-hidden="true" size={16} />
              {t(`languages.${association.primary_language}`)}
            </dd>
          </div>
          <div className="space-y-2">
            <dt className="text-sm font-medium text-secondary">{t('contactLabel')}</dt>
            <dd className="text-heading">{t('contactDescription')}</dd>
          </div>
        </dl>

        {association.claim_status === 'unclaimed' ? (
          <Link className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-heading shadow-card" href={{ pathname: '/register', query: { claim: association.id } }}>
            <ShieldCheck aria-hidden="true" size={16} />
            {t('claimAction')}
          </Link>
        ) : null}

        <RequestToConnectAssociationForm associationId={association.id} locale={params.locale} />
      </section>
    </main>
  );
}
