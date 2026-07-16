import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';

import { EvidenceViewer } from '@/features/evidence';
import { ApproveMemberForm } from '@/features/memberships/components/ApproveMemberForm';
import { DeclineForm } from '@/features/memberships/components/DeclineForm';
import { RequestEvidenceForm } from '@/features/memberships/components/RequestEvidenceForm';
import { SINReveal } from '@/features/memberships/components/SINReveal';
import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const evidenceSchema = z.object({
  evidence_type: z.enum(['government_id', 'immigration_proof']),
  id: z.string().uuid(),
  status: z.enum(['pending', 'uploaded', 'destroyed']),
  storage_path: z.string()
});

const memberDetailSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  status: z.enum(['pending', 'needs_more_evidence', 'active', 'declined', 'suspended']),
  associations: z.object({ name: z.string() }).nullable(),
  evidence_uploads: z.array(evidenceSchema).nullable(),
  users: z
    .object({
      date_of_arrival_canada: z.string().nullable(),
      email: z.string().nullable(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
      phone: z.string().nullable()
    })
    .nullable()
});

const referrerUserSchema = z.object({
  email: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable()
});

const referrerSchema = z.object({
  users: z.union([referrerUserSchema, z.array(referrerUserSchema)]).nullable()
});

type AdminMemberDetailPageProps = {
  params: {
    locale: 'en' | 'fr';
    membershipId: string;
  };
};

async function getMemberDetail(membershipId: string) {
  const adminSupabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-06: platform admin review shapes the full private review DTO server-side.
  const { data, error } = await adminSupabase
    .from('association_members')
    .select(
      'id,created_at,status,associations:association_id(name),users:user_id(first_name,last_name,email,phone,date_of_arrival_canada),evidence_uploads(id,evidence_type,status,storage_path)'
    )
    .eq('id', membershipId)
    .maybeSingle();

  if (error || data === null) {
    return null;
  }

  const parsed = memberDetailSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

async function getReferrer(membershipId: string) {
  const adminSupabase = createSupabaseAdminClient();
  const { data: membership } = await adminSupabase.from('association_members').select('association_id,user_id').eq('id', membershipId).maybeSingle();

  if (membership === null) {
    return null;
  }

  const { data } = await adminSupabase
    .from('referral_tokens')
    .select('users:created_by(first_name,last_name,email)')
    .eq('association_id', membership.association_id)
    .eq('used_by', membership.user_id)
    .order('used_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const parsed = referrerSchema.safeParse(data);
  const users = parsed.success ? parsed.data.users : null;
  return Array.isArray(users) ? (users[0] ?? null) : users;
}

export default async function AdminMemberDetailPage({ params }: AdminMemberDetailPageProps) {
  const currentUser = await requirePlatformAdmin();
  const t = await getTranslations('memberships.review');
  const statusT = await getTranslations('memberships.adminMembers.statuses');
  const evidenceT = await getTranslations('memberships.admin.evidenceTypes');
  const format = await getFormatter();
  const member = await getMemberDetail(params.membershipId);

  if (member === null) {
    notFound();
  }

  const referrer = await getReferrer(member.id);
  const fullName = [member.users?.first_name, member.users?.last_name].filter(Boolean).join(' ');
  const referrerName = [referrer?.first_name, referrer?.last_name].filter(Boolean).join(' ');
  const adminLabel = currentUser.user.email ?? currentUser.user.id;
  const canReview = member.status === 'pending' || member.status === 'needs_more_evidence';

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <h1 className="text-3xl font-semibold leading-tight text-heading">{fullName.length > 0 ? fullName : t('unknownMember')}</h1>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/admin/members"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {t('backToMembers')}
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
            <h2 className="text-xl font-semibold text-heading">{t('applicantTitle')}</h2>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-secondary">{t('associationLabel')}</dt>
                <dd className="mt-1 text-heading">{member.associations?.name ?? t('notProvided')}</dd>
              </div>
              <div>
                <dt className="font-medium text-secondary">{t('statusLabel')}</dt>
                <dd className="mt-1 text-heading">{statusT(member.status)}</dd>
              </div>
              <div>
                <dt className="font-medium text-secondary">{t('emailLabel')}</dt>
                <dd className="mt-1 text-heading">{member.users?.email ?? t('notProvided')}</dd>
              </div>
              <div>
                <dt className="font-medium text-secondary">{t('phoneLabel')}</dt>
                <dd className="mt-1 text-heading">{member.users?.phone ?? t('notProvided')}</dd>
              </div>
              <div>
                <dt className="font-medium text-secondary">{t('arrivalDateLabel')}</dt>
                <dd className="mt-1 text-heading">
                  {member.users?.date_of_arrival_canada === null || member.users?.date_of_arrival_canada === undefined
                    ? t('notProvided')
                    : format.dateTime(new Date(member.users.date_of_arrival_canada), { dateStyle: 'medium' })}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-secondary">{t('submittedAtLabel')}</dt>
                <dd className="mt-1 text-heading">{format.dateTime(new Date(member.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              </div>
            </dl>
          </section>

          <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
            <h2 className="text-xl font-semibold text-heading">{t('referrerTitle')}</h2>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-medium text-secondary">{t('referrerNameLabel')}</dt>
                <dd className="mt-1 text-heading">{referrerName.length > 0 ? referrerName : t('notProvided')}</dd>
              </div>
              <div>
                <dt className="font-medium text-secondary">{t('referrerEmailLabel')}</dt>
                <dd className="mt-1 text-heading">{referrer?.email ?? t('notProvided')}</dd>
              </div>
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-medium text-secondary">{t('sinLabel')}</h3>
              <SINReveal membershipId={member.id} />
            </div>
          </section>
        </div>

        <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
          <h2 className="text-xl font-semibold text-heading">{t('evidenceTitle')}</h2>
          {member.evidence_uploads === null || member.evidence_uploads.length === 0 ? (
            <p className="text-sm text-secondary">{t('notProvided')}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {member.evidence_uploads.map((evidence) =>
                evidence.status === 'destroyed' ? (
                  <p className="rounded-sm border border-border bg-sunken p-4 text-sm text-muted" key={evidence.id}>
                    {evidenceT(evidence.evidence_type)}
                  </p>
                ) : (
                  <div className="grid gap-2" key={evidence.id}>
                    <h3 className="text-sm font-medium text-secondary">{evidenceT(evidence.evidence_type)}</h3>
                    <EvidenceViewer adminLabel={adminLabel} evidenceId={evidence.id} fileName={evidenceT(evidence.evidence_type)} storagePath={evidence.storage_path} />
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {canReview ? (
          <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
            <h2 className="text-xl font-semibold text-heading">{t('decisionTitle')}</h2>
            <div className="grid gap-4 xl:grid-cols-3">
              <ApproveMemberForm locale={params.locale} membershipId={member.id} />
              <RequestEvidenceForm locale={params.locale} membershipId={member.id} />
              <DeclineForm locale={params.locale} membershipId={member.id} />
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
