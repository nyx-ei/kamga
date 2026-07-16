import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2, ExternalLink, FileCheck2 } from 'lucide-react';
import { z } from 'zod';

import { ASSOCIATION_STATUSES, type AssociationStatus } from '@/features/associations/association-types';
import { AssociationReviewActions } from '@/features/associations/components/AssociationReviewActions';
import { AssociationStatusBadge } from '@/features/associations/components/AssociationStatusBadge';
import { MembershipReviewActions } from '@/features/memberships/components/MembershipReviewActions';
import { SINReveal } from '@/features/memberships/components/SINReveal';
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

const adminMembershipEvidenceSchema = z.object({
  evidence_type: z.enum(['government_id', 'immigration_proof']),
  status: z.enum(['pending', 'uploaded', 'destroyed']),
  storage_path: z.string()
});

const adminMembershipSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  associations: z.object({ name: z.string() }).nullable(),
  users: z
    .object({
      email: z.string().nullable(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable()
    })
    .nullable(),
  evidence_uploads: z.array(adminMembershipEvidenceSchema).nullable()
});

type AdminAssociationsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

type AdminAssociation = z.infer<typeof adminAssociationSchema> & {
  proofUrl: string | null;
};

type AdminMembership = Omit<z.infer<typeof adminMembershipSchema>, 'evidence_uploads'> & {
  evidence: Array<z.infer<typeof adminMembershipEvidenceSchema> & { signedUrl: string | null }>;
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

async function listPendingMemberships(): Promise<AdminMembership[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_members')
    .select(
      'id,created_at,associations:association_id(name),users:user_id(first_name,last_name,email),evidence_uploads(evidence_type,status,storage_path)'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  const adminSupabase = createSupabaseAdminClient();
  const rows = data.flatMap((row: unknown) => {
    const parsed = adminMembershipSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  return Promise.all(
    rows.map(async (row) => {
      const evidence = await Promise.all(
        (row.evidence_uploads ?? []).map(async (evidenceRow) => {
          if (evidenceRow.status === 'destroyed') {
            return { ...evidenceRow, signedUrl: null };
          }

          // CV-DB-04 / CV-SEC-07: platform admin review needs a short-lived private storage URL.
          const { data: signedUrlData } = await adminSupabase.storage
            .from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET)
            .createSignedUrl(evidenceRow.storage_path, 300);

          return { ...evidenceRow, signedUrl: signedUrlData?.signedUrl ?? null };
        })
      );

      return {
        associations: row.associations,
        created_at: row.created_at,
        evidence,
        id: row.id,
        users: row.users
      };
    })
  );
}

export default async function AdminAssociationsPage({ params }: AdminAssociationsPageProps) {
  await requirePlatformAdmin();

  const t = await getTranslations('associations.admin');
  const membershipT = await getTranslations('memberships.admin');
  const statusT = await getTranslations('associations.status');
  const format = await getFormatter();
  const associations = await listAdminAssociations();
  const pendingMemberships = await listPendingMemberships();

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

        <div className="border-t border-border pt-6">
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted">{membershipT('badge')}</p>
            <h2 className="text-2xl font-semibold text-heading">{membershipT('title')}</h2>
            <p className="max-w-3xl text-sm leading-6 text-secondary">{membershipT('description')}</p>
          </div>

          {pendingMemberships.length === 0 ? (
            <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{membershipT('emptyState')}</div>
          ) : (
            <div className="grid gap-4">
              {pendingMemberships.map((membership) => {
                const fullName = [membership.users?.first_name, membership.users?.last_name].filter(Boolean).join(' ');

                return (
                  <article className="grid gap-5 rounded-md border border-border bg-raised p-5 shadow-card" key={membership.id}>
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted">{membership.associations?.name ?? membershipT('unknownAssociation')}</p>
                        <h3 className="text-xl font-semibold text-heading">{fullName.length > 0 ? fullName : membershipT('unknownMember')}</h3>
                        <p className="text-sm text-secondary">{membership.users?.email ?? membershipT('notProvided')}</p>
                      </div>
                      <MembershipReviewActions locale={params.locale} membershipId={membership.id} />
                    </div>

                    <dl className="grid gap-4 rounded-sm border border-border bg-sunken p-4 text-sm lg:grid-cols-3">
                      <div>
                        <dt className="font-medium text-secondary">{membershipT('submittedAtLabel')}</dt>
                        <dd className="mt-1 text-heading">{format.dateTime(new Date(membership.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-secondary">{membershipT('sinLabel')}</dt>
                        <dd className="mt-2">
                          <SINReveal membershipId={membership.id} />
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-secondary">{membershipT('evidenceLabel')}</dt>
                        <dd className="mt-2 grid gap-2">
                          {membership.evidence.length === 0 ? <span className="text-muted">{membershipT('notProvided')}</span> : null}
                          {membership.evidence.map((evidence) =>
                            evidence.signedUrl === null ? (
                              <span className="text-muted" key={evidence.storage_path}>
                                {membershipT(`evidenceTypes.${evidence.evidence_type}`)}
                              </span>
                            ) : (
                              <a
                                className="inline-flex items-center gap-2 font-medium text-link transition hover:text-link-hover"
                                href={evidence.signedUrl}
                                key={evidence.storage_path}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <FileCheck2 aria-hidden="true" size={14} />
                                {membershipT(`evidenceTypes.${evidence.evidence_type}`)}
                              </a>
                            )
                          )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}


