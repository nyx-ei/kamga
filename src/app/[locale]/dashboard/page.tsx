import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { z } from 'zod';

import { LogoutButton } from '@/features/auth';
import { ApplicationStatusCard } from '@/features/memberships';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const evidenceTypeSchema = z.enum(['government_id', 'immigration_proof']);
const memberApplicationStatusSchema = z.enum(['pending', 'needs_more_evidence', 'active', 'declined', 'suspended']);

const associationSummarySchema = z.object({
  name: z.string()
});

const memberApplicationSchema = z.object({
  associations: z.union([associationSummarySchema, z.array(associationSummarySchema)]).nullable(),
  created_at: z.string(),
  decline_reason_html: z.string().nullable(),
  id: z.string().uuid(),
  requested_evidence_types: z.array(evidenceTypeSchema).nullable(),
  status: memberApplicationStatusSchema
});

type DashboardPageProps = {
  searchParams: {
    associationSubmitted?: string;
    registration?: string;
  };
};

type MemberApplication = z.infer<typeof memberApplicationSchema>;

async function listMemberApplications(userId: string): Promise<MemberApplication[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_members')
    .select('id,created_at,status,decline_reason_html,requested_evidence_types,associations:association_id(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = memberApplicationSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function associationName(application: MemberApplication): string {
  const association = Array.isArray(application.associations) ? application.associations[0] : application.associations;
  return association?.name ?? application.id;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentUser = await requireUser();
  const t = await getTranslations('dashboard');
  const format = await getFormatter();
  const applications = await listMemberApplications(currentUser.user.id);

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-5xl flex-col gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
          <p className="text-base leading-7 text-secondary">{t('description')}</p>
        </div>

        {searchParams.associationSubmitted === '1' ? (
          <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('associationSubmitted')}</p>
        ) : null}
        {searchParams.registration === 'pending' ? (
          <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('memberRegistrationPending')}</p>
        ) : null}

        <dl className="rounded-sm border border-border bg-sunken p-4">
          <dt className="text-sm font-medium text-secondary">{t('roleLabel')}</dt>
          <dd className="mt-1 font-mono text-sm text-heading">{currentUser.role ?? t('unknownRole')}</dd>
        </dl>

        <section className="grid gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-heading">{t('applicationsTitle')}</h2>
            <p className="text-sm leading-6 text-secondary">{t('applicationsDescription')}</p>
          </div>
          {applications.length === 0 ? (
            <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('noApplications')}</div>
          ) : (
            <div className="grid gap-4">
              {applications.map((application) => (
                <ApplicationStatusCard
                  application={{
                    associationName: associationName(application),
                    declineReasonHtml: application.decline_reason_html,
                    requestedEvidenceTypes: application.requested_evidence_types ?? [],
                    status: application.status,
                    submittedAtLabel: format.dateTime(new Date(application.created_at), { dateStyle: 'medium', timeStyle: 'short' })
                  }}
                  key={application.id}
                />
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
            href="/register"
          >
            <Building2 aria-hidden="true" size={16} />
            {t('registerAssociationAction')}
          </Link>
          <LogoutButton className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong" />
        </div>
      </section>
    </main>
  );
}
