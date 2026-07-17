import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { z } from 'zod';

import { MemberWorkspaceShell } from '@/components/kamga/MockupShell';
import { LogoutButton } from '@/features/auth';
import { FiscalSlipPanel } from '@/features/fiscal';
import {
  AssociationLeveeCallStatusForm,
  ContributionProgressRealtime,
  FinancialSettingsForm,
  MarkAssociationRemittedForm,
  RecordContributionPaymentForm,
  StripeContributionCheckoutForm
} from '@/features/levees';
import { ApplicationStatusCard, DependentsManager } from '@/features/memberships';
import { ApproveMemberForm } from '@/features/memberships/components/ApproveMemberForm';
import { DeclineForm } from '@/features/memberships/components/DeclineForm';
import { NotificationCenter, PaymentReminderForm } from '@/features/notifications';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { currentFiscalYear } from '@/lib/fiscal/tax-receipts';
import { listUserNotifications } from '@/lib/notifications/list';
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
  member_contributions: z
    .array(
      z.object({
        amount_due_cents: z.number(),
        amount_paid_cents: z.number(),
        association_members: z
          .union([
            z.object({
              users: z
                .union([
                  z.object({
                    email: z.string().nullable(),
                    first_name: z.string().nullable(),
                    last_name: z.string().nullable()
                  }),
                  z.array(
                    z.object({
                      email: z.string().nullable(),
                      first_name: z.string().nullable(),
                      last_name: z.string().nullable()
                    })
                  )
                ])
                .nullable()
            }),
            z.array(
              z.object({
                users: z
                  .union([
                    z.object({
                      email: z.string().nullable(),
                      first_name: z.string().nullable(),
                      last_name: z.string().nullable()
                    }),
                    z.array(
                      z.object({
                        email: z.string().nullable(),
                        first_name: z.string().nullable(),
                        last_name: z.string().nullable()
                      })
                    )
                  ])
                  .nullable()
              })
            )
          ])
          .nullable(),
        id: z.string().uuid(),
        recorded_at: z.string().nullable(),
        share_count: z.number().int(),
        status: z.enum(['unpaid', 'partial', 'paid'])
      })
    )
    .nullable(),
  share_count: z.number().int(),
  status: z.enum(['pending', 'in_progress', 'completed'])
});

const contributionProgressSchema = z.object({
  association_levee_call_id: z.string().uuid(),
  collected_amount_cents: z.number(),
  member_count: z.number().int(),
  paid_member_count: z.number().int(),
  partial_member_count: z.number().int(),
  remitted_at: z.string().nullable(),
  outstanding_amount_cents: z.number(),
  target_amount_cents: z.number(),
  unpaid_member_count: z.number().int()
});

const memberContributionSchema = z.object({
  amount_due_cents: z.number(),
  amount_paid_cents: z.number(),
  association_levee_calls: z
    .object({
      associations: z.union([z.object({ name: z.string() }), z.array(z.object({ name: z.string() }))]).nullable(),
      levees: z
        .object({
          deadline: z.string(),
          deceased_full_name: z.string(),
          status: z.enum(['active', 'closed', 'cancelled'])
        })
        .nullable()
    })
    .nullable(),
  created_at: z.string(),
  id: z.string().uuid(),
  member_contribution_payments: z
    .array(
      z.object({
        amount_applied_cents: z.number(),
        amount_received_cents: z.number(),
        created_at: z.string(),
        id: z.string().uuid(),
        overpayment_cents: z.number(),
        stripe_checkout_session_id: z.string(),
        stripe_receipt_url: z.string().nullable()
      })
    )
    .nullable(),
  share_count: z.number().int(),
  status: z.enum(['unpaid', 'partial', 'paid'])
});

const joinRequestSchema = z.object({
  associations: z.union([associationSummarySchema, z.array(associationSummarySchema)]).nullable(),
  created_at: z.string(),
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  users: z
    .union([
      z.object({
        email: z.string().nullable(),
        first_name: z.string().nullable(),
        last_name: z.string().nullable()
      }),
      z.array(
        z.object({
          email: z.string().nullable(),
          first_name: z.string().nullable(),
          last_name: z.string().nullable()
        })
      )
    ])
    .nullable()
});

const financialSettingsSchema = z.object({
  payment_preference: z.enum(['manual', 'auto_pay']),
  stripe_customer_id: z.string().nullable()
});

type DashboardPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    associationSubmitted?: string;
    joinRequest?: string;
    payment?: string;
    registration?: string;
  };
};

type MemberApplication = z.infer<typeof memberApplicationSchema>;
type AssociationLeveeCall = z.infer<typeof associationLeveeCallSchema>;
type ContributionProgress = z.infer<typeof contributionProgressSchema>;
type MemberContribution = z.infer<typeof memberContributionSchema>;
type JoinRequest = z.infer<typeof joinRequestSchema>;
type FinancialSettings = z.infer<typeof financialSettingsSchema>;

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

function memberContributionAssociationName(contribution: MemberContribution): string | null {
  const association = Array.isArray(contribution.association_levee_calls?.associations)
    ? contribution.association_levee_calls?.associations[0]
    : contribution.association_levee_calls?.associations;
  return association?.name ?? null;
}

function contributionMemberLabel(contribution: NonNullable<AssociationLeveeCall['member_contributions']>[number]): string {
  const membership = Array.isArray(contribution.association_members) ? contribution.association_members[0] : contribution.association_members;
  const user = Array.isArray(membership?.users) ? membership?.users[0] : membership?.users;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return fullName.length > 0 ? fullName : (user?.email ?? contribution.id);
}

function joinRequestApplicantName(request: JoinRequest): string {
  const user = Array.isArray(request.users) ? request.users[0] : request.users;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return fullName.length > 0 ? fullName : (user?.email ?? request.id);
}

function joinRequestAssociationName(request: JoinRequest): string | null {
  const association = Array.isArray(request.associations) ? request.associations[0] : request.associations;
  return association?.name ?? null;
}

function isActiveMemberContribution(contribution: MemberContribution): boolean {
  const levee = contribution.association_levee_calls?.levees;

  if (levee === null || levee === undefined) {
    return contribution.status !== 'paid';
  }

  return levee.status === 'active' && contribution.status !== 'paid';
}

async function listAssociationLeveeCalls(): Promise<AssociationLeveeCall[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_levee_calls')
    .select(
      'id,share_count,amount_due_cents,status,associations:association_id(name),levees:levee_id(deceased_full_name,deadline,per_share_amount_cents),member_contributions(id,share_count,amount_due_cents,amount_paid_cents,status,recorded_at,association_members:membership_id(users:user_id(first_name,last_name,email)))'
    )
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = associationLeveeCallSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function listContributionProgress(callIds: string[]): Promise<Map<string, ContributionProgress>> {
  if (callIds.length === 0) {
    return new Map();
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_levee_collection_summary')
    .select('association_levee_call_id,target_amount_cents,collected_amount_cents,outstanding_amount_cents,remitted_at,member_count,paid_member_count,partial_member_count,unpaid_member_count')
    .in('association_levee_call_id', callIds);

  if (error || data === null) {
    return new Map();
  }

  return new Map(
    data.flatMap((row: unknown) => {
      const parsed = contributionProgressSchema.safeParse(row);
      return parsed.success ? [[parsed.data.association_levee_call_id, parsed.data] as const] : [];
    })
  );
}

async function listMemberContributions(): Promise<MemberContribution[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('member_contributions')
    .select(
      'id,created_at,share_count,amount_due_cents,amount_paid_cents,status,association_levee_calls:association_levee_call_id(associations:association_id(name),levees:levee_id(deceased_full_name,deadline,status)),member_contribution_payments(id,amount_received_cents,amount_applied_cents,overpayment_cents,stripe_checkout_session_id,stripe_receipt_url,created_at)'
    )
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = memberContributionSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function getFinancialSettings(userId: string): Promise<FinancialSettings> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from('user_financial_settings').select('payment_preference,stripe_customer_id').eq('user_id', userId).maybeSingle();

  if (error || data === null) {
    return {
      payment_preference: 'manual',
      stripe_customer_id: null
    };
  }

  const parsed = financialSettingsSchema.safeParse(data);

  if (!parsed.success) {
    return {
      payment_preference: 'manual',
      stripe_customer_id: null
    };
  }

  return parsed.data;
}

async function listJoinRequests(currentUserId: string): Promise<JoinRequest[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_members')
    .select('id,user_id,created_at,associations:association_id(name),users:user_id(first_name,last_name,email)')
    .eq('status', 'pending')
    .eq('role', 'member')
    .is('referred_by', null)
    .neq('user_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = joinRequestSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const currentUser = await requireUser();
  const t = await getTranslations('dashboard');
  const format = await getFormatter();
  const applications = await listMemberApplications(currentUser.user.id);
  const associationCalls = await listAssociationLeveeCalls();
  const contributionProgress = await listContributionProgress(associationCalls.map((call) => call.id));
  const memberContributions = await listMemberContributions();
  const joinRequests = await listJoinRequests(currentUser.user.id);
  const financialSettings = await getFinancialSettings(currentUser.user.id);
  const notifications = await listUserNotifications();
  const fiscalYear = currentFiscalYear();
  const activeMemberContributions = memberContributions.filter(isActiveMemberContribution);
  const contributionHistory = memberContributions.filter((contribution) => !isActiveMemberContribution(contribution));

  return (
    <MemberWorkspaceShell
      locale={params.locale}
      title={t('title')}
      toolbar={<LogoutButton className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong" />}
      userEmail={currentUser.user.email}
    >
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3" id="overview">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <p className="text-base leading-7 text-secondary">{t('description')}</p>
        </div>

        {searchParams.associationSubmitted === '1' ? (
          <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('associationSubmitted')}</p>
        ) : null}
        {searchParams.registration === 'pending' ? (
          <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('memberRegistrationPending')}</p>
        ) : null}
        {searchParams.joinRequest === '1' ? (
          <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('joinRequest')}</p>
        ) : null}
        {searchParams.payment === 'success' ? (
          <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('paymentSuccess')}</p>
        ) : null}
        {searchParams.payment === 'cancelled' ? (
          <p className="rounded-sm border border-border bg-warning-bg px-4 py-3 text-sm font-medium text-warning">{t('paymentCancelled')}</p>
        ) : null}

        <dl className="rounded-sm border border-border bg-sunken p-4">
          <dt className="text-sm font-medium text-secondary">{t('roleLabel')}</dt>
          <dd className="mt-1 font-mono text-sm text-heading">{currentUser.role ?? t('unknownRole')}</dd>
        </dl>

        <div id="payments">
          <FinancialSettingsForm hasStripeCustomer={financialSettings.stripe_customer_id !== null} locale={params.locale} paymentPreference={financialSettings.payment_preference} />
        </div>

        <div id="notifications">
          <NotificationCenter
            notifications={notifications.map((notification) => ({
              ...notification,
              createdAtLabel: format.dateTime(new Date(notification.createdAt), { dateStyle: 'medium', timeStyle: 'short' })
            }))}
            unreadCount={notifications.filter((notification) => !notification.isRead).length}
          />
        </div>

        <div id="receipts">
          <FiscalSlipPanel currentYear={fiscalYear} locale={params.locale} years={[fiscalYear, fiscalYear - 1, fiscalYear - 2]} />
        </div>

        <section className="grid gap-4" id="applications">
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
                    {application.status === 'active' ? (
                      <div id="relatives">
                        <DependentsManager dependents={dependents} membershipId={application.id} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {joinRequests.length === 0 ? null : (
          <section className="grid gap-4" id="contributions">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-heading">{t('joinRequestsTitle')}</h2>
              <p className="text-sm leading-6 text-secondary">{t('joinRequestsDescription')}</p>
            </div>
            <div className="grid gap-4">
              {joinRequests.map((request) => (
                <article className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card" key={request.id}>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">{joinRequestAssociationName(request) ?? t('unknownAssociation')}</p>
                      <h3 className="mt-1 text-lg font-semibold text-heading">{joinRequestApplicantName(request)}</h3>
                    </div>
                    <p className="text-sm text-secondary">{format.dateTime(new Date(request.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <ApproveMemberForm locale={params.locale} membershipId={request.id} />
                    <DeclineForm locale={params.locale} membershipId={request.id} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeMemberContributions.length === 0 ? null : (
          <section className="grid gap-4" id={activeMemberContributions.length === 0 ? 'contributions' : undefined}>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-heading">{t('activeLeveesTitle')}</h2>
              <p className="text-sm leading-6 text-secondary">{t('activeLeveesDescription')}</p>
            </div>
            <div className="grid gap-4">
              {activeMemberContributions.map((contribution) => {
                const remainingCents = Math.max(0, Math.round(contribution.amount_due_cents - contribution.amount_paid_cents));

                return (
                  <article className="grid gap-3 rounded-md border border-border bg-raised p-5 shadow-card" key={contribution.id}>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted">{memberContributionAssociationName(contribution) ?? t('unknownAssociation')}</p>
                        <h3 className="mt-1 text-lg font-semibold text-heading">{contribution.association_levee_calls?.levees?.deceased_full_name ?? t('unknownLevee')}</h3>
                      </div>
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <p className="rounded-sm bg-warning-bg px-3 py-2 text-sm font-medium text-warning">{t(`contributionStatuses.${contribution.status}`)}</p>
                        <StripeContributionCheckoutForm contributionId={contribution.id} disabled={remainingCents <= 0} locale={params.locale} />
                      </div>
                    </div>
                    <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-5">
                      <div>
                        <dt className="font-medium text-secondary">{t('callSharesLabel')}</dt>
                        <dd className="mt-1 font-mono text-heading">{contribution.share_count}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-secondary">{t('currentShareStatusLabel')}</dt>
                        <dd className="mt-1 text-heading">{t(`contributionStatuses.${contribution.status}`)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-secondary">{t('callAmountLabel')}</dt>
                        <dd className="mt-1 text-heading">{format.number(contribution.amount_due_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-secondary">{t('amountPaidLabel')}</dt>
                        <dd className="mt-1 text-heading">{format.number(contribution.amount_paid_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-secondary">{t('callDeadlineLabel')}</dt>
                        <dd className="mt-1 text-heading">
                          {contribution.association_levee_calls?.levees === null || contribution.association_levee_calls?.levees === undefined
                            ? t('notAvailable')
                            : format.dateTime(new Date(contribution.association_levee_calls.levees.deadline), { dateStyle: 'medium' })}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {contributionHistory.length === 0 ? null : (
          <section className="grid gap-4" id={activeMemberContributions.length === 0 && contributionHistory.length === 0 ? 'contributions' : undefined}>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-heading">{t('contributionHistoryTitle')}</h2>
              <p className="text-sm leading-6 text-secondary">{t('contributionHistoryDescription')}</p>
            </div>
            <div className="grid gap-4">
              {contributionHistory.map((contribution) => (
                <article className="grid gap-3 rounded-md border border-border bg-raised p-5 shadow-card" key={contribution.id}>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">{memberContributionAssociationName(contribution) ?? t('unknownAssociation')}</p>
                      <h3 className="mt-1 text-lg font-semibold text-heading">{contribution.association_levee_calls?.levees?.deceased_full_name ?? t('unknownLevee')}</h3>
                    </div>
                    <p className="w-fit rounded-sm bg-warning-bg px-3 py-2 text-sm font-medium text-warning">{t(`contributionStatuses.${contribution.status}`)}</p>
                  </div>
                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-4">
                    <div>
                      <dt className="font-medium text-secondary">{t('callSharesLabel')}</dt>
                      <dd className="mt-1 font-mono text-heading">{contribution.share_count}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('callAmountLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.number(contribution.amount_due_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('amountPaidLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.number(contribution.amount_paid_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('callDeadlineLabel')}</dt>
                      <dd className="mt-1 text-heading">
                        {contribution.association_levee_calls?.levees === null || contribution.association_levee_calls?.levees === undefined
                          ? t('notAvailable')
                          : format.dateTime(new Date(contribution.association_levee_calls.levees.deadline), { dateStyle: 'medium' })}
                      </dd>
                    </div>
                  </dl>
                  {contribution.member_contribution_payments === null || contribution.member_contribution_payments.length === 0 ? null : (
                    <section className="grid gap-2 rounded-sm border border-border bg-sunken p-4">
                      <h4 className="text-sm font-semibold text-heading">{t('receiptsTitle')}</h4>
                      <div className="grid gap-2">
                        {contribution.member_contribution_payments.map((payment) => (
                          <div className="grid gap-2 rounded-sm border border-border bg-card p-3 text-sm md:grid-cols-5" key={payment.id}>
                            <div>
                              <p className="font-medium text-secondary">{t('receiptDateLabel')}</p>
                              <p className="mt-1 text-heading">{format.dateTime(new Date(payment.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                            </div>
                            <div>
                              <p className="font-medium text-secondary">{t('receiptReceivedLabel')}</p>
                              <p className="mt-1 text-heading">{format.number(payment.amount_received_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                            </div>
                            <div>
                              <p className="font-medium text-secondary">{t('receiptAppliedLabel')}</p>
                              <p className="mt-1 text-heading">{format.number(payment.amount_applied_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                            </div>
                            <div>
                              <p className="font-medium text-secondary">{t('receiptOverpaymentLabel')}</p>
                              <p className="mt-1 text-heading">{format.number(payment.overpayment_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                            </div>
                            <div>
                              <p className="font-medium text-secondary">{t('receiptReferenceLabel')}</p>
                              <p className="mt-1 font-mono text-xs text-heading">{payment.stripe_checkout_session_id}</p>
                              <a
                                className="mt-2 inline-flex w-fit rounded-sm border border-border bg-card px-3 py-2 text-xs font-medium text-heading shadow-card transition hover:border-border-strong"
                                href={`/api/payments/${payment.id}/receipt`}
                                target="_blank"
                              >
                                {t('receiptDownloadAction')}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {associationCalls.length === 0 ? null : (
          <section className="grid gap-4">
            <ContributionProgressRealtime callIds={associationCalls.map((call) => call.id)} />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-heading">{t('incomingCallsTitle')}</h2>
              <p className="text-sm leading-6 text-secondary">{t('incomingCallsDescription')}</p>
            </div>
            <div className="grid gap-4">
              {associationCalls.map((call) => (
                <article className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card" key={call.id}>
                  {(() => {
                    const progress = contributionProgress.get(call.id);
                    const collected = progress?.collected_amount_cents ?? 0;
                    const target = progress?.target_amount_cents ?? call.amount_due_cents;
                    const outstanding = progress?.outstanding_amount_cents ?? Math.max(call.amount_due_cents - collected, 0);
                    const progressPercent = target <= 0 ? 0 : Math.min(100, Math.round((collected / target) * 100));
                    const isRemitted = progress?.remitted_at !== null && progress?.remitted_at !== undefined;

                    return (
                      <section className="grid gap-3 rounded-sm border border-border bg-sunken p-4">
                        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                          <div>
                            <h4 className="text-sm font-semibold text-heading">{t('collectionProgressTitle')}</h4>
                            <p className="text-sm text-secondary">
                              {t('collectionProgressValue', {
                                collected: format.number(collected / 100, { currency: 'CAD', style: 'currency' }),
                                target: format.number(target / 100, { currency: 'CAD', style: 'currency' })
                              })}
                            </p>
                          </div>
                          <p className="font-mono text-sm text-heading">{progressPercent}%</p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-sm bg-card">
                          <div className="h-full bg-brand" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <p className="text-xs text-muted">
                          {t('collectionBreakdown', {
                            paid: progress?.paid_member_count ?? 0,
                            partial: progress?.partial_member_count ?? 0,
                            unpaid: progress?.unpaid_member_count ?? 0
                          })}
                        </p>
                        <dl className="grid gap-3 text-sm md:grid-cols-3">
                          <div>
                            <dt className="font-medium text-secondary">{t('outstandingLabel')}</dt>
                            <dd className="mt-1 text-heading">{format.number(outstanding / 100, { currency: 'CAD', style: 'currency' })}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-secondary">{t('remittanceStatusLabel')}</dt>
                            <dd className="mt-1 text-heading">{isRemitted ? t('remitted') : t('notRemitted')}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-secondary">{t('remittedAtLabel')}</dt>
                            <dd className="mt-1 text-heading">{progress?.remitted_at === null || progress?.remitted_at === undefined ? t('notAvailable') : format.dateTime(new Date(progress.remitted_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                          </div>
                        </dl>
                        <MarkAssociationRemittedForm callId={call.id} disabled={isRemitted || outstanding > 0} locale={params.locale} />
                      </section>
                    );
                  })()}
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
                  {call.member_contributions === null || call.member_contributions.length === 0 ? (
                    <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('noMemberContributions')}</div>
                  ) : (
                    <section className="grid gap-3">
                      <h4 className="text-base font-semibold text-heading">{t('memberCollectionTitle')}</h4>
                      <div className="grid gap-3">
                        {call.member_contributions.map((contribution) => (
                          <article className="grid gap-4 rounded-sm border border-border bg-card p-4" key={contribution.id}>
                            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                              <div>
                                <h5 className="font-semibold text-heading">{contributionMemberLabel(contribution)}</h5>
                                <p className="text-sm text-secondary">{t(`contributionStatuses.${contribution.status}`)}</p>
                              </div>
                              <p className="text-sm font-medium text-heading">
                                {format.number(contribution.amount_paid_cents / 100, { currency: 'CAD', style: 'currency' })} /{' '}
                                {format.number(contribution.amount_due_cents / 100, { currency: 'CAD', style: 'currency' })}
                              </p>
                            </div>
                            <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-3 text-sm md:grid-cols-3">
                              <div>
                                <dt className="font-medium text-secondary">{t('callSharesLabel')}</dt>
                                <dd className="mt-1 font-mono text-heading">{contribution.share_count}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-secondary">{t('amountPaidLabel')}</dt>
                                <dd className="mt-1 text-heading">{format.number(contribution.amount_paid_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-secondary">{t('recordedAtLabel')}</dt>
                                <dd className="mt-1 text-heading">
                                  {contribution.recorded_at === null ? t('notAvailable') : format.dateTime(new Date(contribution.recorded_at), { dateStyle: 'medium', timeStyle: 'short' })}
                                </dd>
                              </div>
                            </dl>
                            <RecordContributionPaymentForm amountPaidCents={contribution.amount_paid_cents} contributionId={contribution.id} locale={params.locale} />
                            <PaymentReminderForm contributionId={contribution.id} disabled={contribution.status === 'paid'} locale={params.locale} />
                          </article>
                        ))}
                      </div>
                    </section>
                  )}
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
        </div>
      </section>
    </MemberWorkspaceShell>
  );
}
