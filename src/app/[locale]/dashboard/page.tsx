import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { z } from 'zod';

import { LogoutButton } from '@/features/auth';
import { AssociationLeveeCallStatusForm } from '@/features/levees';
import { ApplicationStatusCard, DependentsManager } from '@/features/memberships';
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
  member_dependents: z
    .array(
      z.object({
        external_id: z.string().nullable(),
        full_name: z.string(),
        id: z.string().uuid(),
        relationship: z.string()
      })
    )
    .nullable(),
  requested_evidence_types: z.array(evidenceTypeSchema).nullable(),
  status: memberApplicationStatusSchema
});

const associationLeveeCallSchema = z.object({
  amount_due_cents: z.number(),
  associations: z.union([z.object({ name: z.string() }), z.array(z.object({ name: z.string() }))]).nullable(),
  id: z.string().uuid(),
  levees: z
    .object({
      deadline: z.string(),
      deceased_full_name: z.string(),
      per_share_amount_cents: z.number()
    })
    .nullable(),
  share_count: z.number().int(),
  status: z.enum(['pending', 'in_progress', 'completed'])
});

type DashboardPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    associationSubmitted?: string;
    registration?: string;
  };
};

type MemberApplication = z.infer<typeof memberApplicationSchema>;
type AssociationLeveeCall = z.infer<typeof associationLeveeCallSchema>;

async function listMemberApplications(userId: string): Promise<MemberApplication[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_members')
    .select('id,created_at,status,decline_reason_html,requested_evidence_types,associations:association_id(name),member_dependents(id,full_name,relationship,external_id)')
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

function callAssociationName(call: AssociationLeveeCall): string | null {
  const association = Array.isArray(call.associations) ? call.associations[0] : call.associations;
  return association?.name ?? null;
}
async function listAssociationLeveeCalls(): Promise<AssociationLeveeCall[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_levee_calls')
    .select('id,share_count,amount_due_cents,status,associations:association_id(name),levees:levee_id(deceased_full_name,deadline,per_share_amount_cents)')
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = associationLeveeCallSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const currentUser = await requireUser();
  const t = await getTranslations('dashboard');
  const format = await getFormatter();
  const applications = await listMemberApplications(currentUser.user.id);
  const associationCalls = await listAssociationLeveeCalls();

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
              {applications.map((application) => {
                const dependents =
                  application.member_dependents?.map((dependent) => ({
                    externalId: dependent.external_id,
                    fullName: dependent.full_name,
                    id: dependent.id,
                    relationship: dependent.relationship
                  })) ?? [];

                return (
                  <div className="grid gap-4" key={application.id}>
                    <ApplicationStatusCard
                      application={{
                        associationName: associationName(application),
                        declineReasonHtml: application.decline_reason_html,
                        requestedEvidenceTypes: application.requested_evidence_types ?? [],
                        status: application.status,
                        submittedAtLabel: format.dateTime(new Date(application.created_at), { dateStyle: 'medium', timeStyle: 'short' })
                      }}
                    />
                    {application.status === 'active' ? <DependentsManager dependents={dependents} membershipId={application.id} /> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {associationCalls.length === 0 ? null : (
          <section className="grid gap-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-heading">{t('incomingCallsTitle')}</h2>
              <p className="text-sm leading-6 text-secondary">{t('incomingCallsDescription')}</p>
            </div>
            <div className="grid gap-4">
              {associationCalls.map((call) => (
                <article className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card" key={call.id}>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">{callAssociationName(call) ?? t('unknownAssociation')}</p>
                      <h3 className="mt-1 text-xl font-semibold text-heading">{call.levees?.deceased_full_name ?? t('unknownLevee')}</h3>
                    </div>
                    <p className="rounded-sm bg-warning-bg px-3 py-2 text-sm font-medium text-warning">{t(`callStatuses.${call.status}`)}</p>
                  </div>
                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-4">
                    <div>
                      <dt className="font-medium text-secondary">{t('callSharesLabel')}</dt>
                      <dd className="mt-1 font-mono text-heading">{call.share_count}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('callAmountLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.number(call.amount_due_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('callPerShareLabel')}</dt>
                      <dd className="mt-1 text-heading">
                        {call.levees === null ? t('notAvailable') : format.number(call.levees.per_share_amount_cents / 100, { currency: 'CAD', style: 'currency' })}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('callDeadlineLabel')}</dt>
                      <dd className="mt-1 text-heading">
                        {call.levees === null ? t('notAvailable') : format.dateTime(new Date(call.levees.deadline), { dateStyle: 'medium' })}
                      </dd>
                    </div>
                  </dl>
                  <AssociationLeveeCallStatusForm callId={call.id} currentStatus={call.status} locale={params.locale} />
                </article>
              ))}
            </div>
          </section>
        )}

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
