import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2, ExternalLink } from 'lucide-react';
import { z } from 'zod';

import { ASSOCIATION_STATUSES, type AssociationStatus } from '@/features/associations/association-types';
import { AssociationReviewActions } from '@/features/associations/components/AssociationReviewActions';
import { AssociationStatusBadge } from '@/features/associations/components/AssociationStatusBadge';
import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const adminAssociationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string(),
  contact_email: z.string().nullable(),
  status: z.enum(ASSOCIATION_STATUSES),
  created_at: z.string(),
  rpn_affiliation_proof_path: z.string().nullable()
});

type AdminAssociationsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

type AdminAssociation = z.infer<typeof adminAssociationSchema> & {
  proofUrl: string | null;
};

async function listAdminAssociations(): Promise<AdminAssociation[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('associations')
    .select('id,name,city,contact_email,status,created_at,rpn_affiliation_proof_path')
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  const adminSupabase = createSupabaseAdminClient();
  const rows = data.flatMap((row: unknown) => {
    const parsed = adminAssociationSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  return Promise.all(
    rows.map(async (row) => {
      if (row.rpn_affiliation_proof_path === null) {
        return { ...row, proofUrl: null };
      }

      // CV-DB-04 / CV-SEC-07: platform admin review needs a short-lived private storage URL.
      const { data: signedUrlData } = await adminSupabase.storage
        .from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET)
        .createSignedUrl(row.rpn_affiliation_proof_path, 300);

      return { ...row, proofUrl: signedUrlData?.signedUrl ?? null };
    })
  );
}

export default async function AdminAssociationsPage({ params }: AdminAssociationsPageProps) {
  await requirePlatformAdmin();

  const t = await getTranslations('associations.admin');
  const statusT = await getTranslations('associations.status');
  const format = await getFormatter();
  const associations = await listAdminAssociations();

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
            <Building2 aria-hidden="true" size={16} />
            {t('backToAdmin')}
          </Link>
        </div>

        {associations.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('emptyState')}</div>
        ) : (
          <div className="grid gap-4">
            {associations.map((association) => (
              <article className="grid gap-5 rounded-md border border-border bg-raised p-5 shadow-card" key={association.id}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="space-y-3">
                    <AssociationStatusBadge label={statusT(association.status)} status={association.status as AssociationStatus} />
                    <div>
                      <h2 className="text-xl font-semibold text-heading">{association.name}</h2>
                      <p className="text-sm text-secondary">{association.city}</p>
                    </div>
                  </div>
                  <AssociationReviewActions associationId={association.id} locale={params.locale} />
                </div>

                <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-3">
                  <div>
                    <dt className="font-medium text-secondary">{t('contactEmailLabel')}</dt>
                    <dd className="mt-1 text-heading">{association.contact_email ?? t('notProvided')}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-secondary">{t('submittedAtLabel')}</dt>
                    <dd className="mt-1 text-heading">{format.dateTime(new Date(association.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-secondary">{t('proofLabel')}</dt>
                    <dd className="mt-1">
                      {association.proofUrl === null ? (
                        <span className="text-muted">{t('notProvided')}</span>
                      ) : (
                        <a
                          className="inline-flex items-center gap-2 font-medium text-link transition hover:text-link-hover"
                          href={association.proofUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink aria-hidden="true" size={14} />
                          {t('openProofAction')}
                        </a>
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}


