import { getFormatter, getTranslations } from 'next-intl/server';
import { Activity, BarChart3, Clock, ReceiptText, UsersRound } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const nullableDateSchema = z.string().nullable();
const moneySchema = z.coerce.number();

const leveeReportSchema = z.object({
  association_count: z.number().int(),
  collected_amount_cents: moneySchema,
  collection_rate: moneySchema,
  created_at: z.string(),
  deadline: z.string(),
  deceased_full_name: z.string(),
  first_payment_at: nullableDateSchema,
  latest_payment_at: nullableDateSchema,
  levee_id: z.string().uuid(),
  outstanding_amount_cents: moneySchema,
  per_share_amount_cents: moneySchema,
  pool_size: z.number().int(),
  remitted_association_count: z.number().int(),
  status: z.enum(['active', 'closed', 'cancelled']),
  target_amount_cents: moneySchema
});

const leveeAssociationBreakdownSchema = z.object({
  association_city: z.string(),
  association_id: z.string().uuid(),
  association_name: z.string(),
  call_status: z.enum(['pending', 'in_progress', 'completed']),
  collected_amount_cents: moneySchema,
  collection_rate: moneySchema,
  member_count: z.number().int(),
  outstanding_amount_cents: moneySchema,
  paid_member_count: z.number().int(),
  partial_member_count: z.number().int(),
  remitted_at: nullableDateSchema,
  share_count: z.number().int(),
  target_amount_cents: moneySchema,
  unpaid_member_count: z.number().int()
});

const memberReportSchema = z.object({
  amount_due_cents: moneySchema,
  amount_paid_cents: moneySchema,
  association_name: z.string(),
  contribution_id: z.string().uuid(),
  deceased_full_name: z.string(),
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  payment_count: z.number().int(),
  share_count: z.number().int(),
  status: z.enum(['unpaid', 'partial', 'paid']),
  total_payment_history_cents: moneySchema
});

const fiscalSummarySchema = z.object({
  association_name: z.string(),
  fiscal_year: z.number().int(),
  latest_payment_at: nullableDateSchema,
  payment_count: z.number().int(),
  total_contributed_cents: moneySchema,
  user_id: z.string().uuid()
});

const rosterSchema = z.object({
  association_name: z.string(),
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  role: z.enum(['association_admin', 'member']),
  share_count: z.number().int(),
  status: z.enum(['pending', 'active', 'declined', 'suspended', 'needs_more_evidence'])
});

const feeEarningsSchema = z.object({
  accrued_amount_cents: moneySchema,
  admin_email: z.string(),
  admin_first_name: z.string().nullable(),
  admin_last_name: z.string().nullable(),
  association_name: z.string(),
  paid_amount_cents: moneySchema,
  total_amount_cents: moneySchema
});

const auditLogSchema = z.object({
  action: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  actor_user_id: z.string().uuid().nullable(),
  changed_columns: z.array(z.string()),
  created_at: z.string(),
  id: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()),
  record_id: z.string().uuid().nullable(),
  table_name: z.string()
});

type AdminReportsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

type LeveeReport = z.infer<typeof leveeReportSchema>;
type LeveeAssociationBreakdown = z.infer<typeof leveeAssociationBreakdownSchema>;
type MemberReport = z.infer<typeof memberReportSchema>;
type FiscalSummary = z.infer<typeof fiscalSummarySchema>;
type RosterRow = z.infer<typeof rosterSchema>;
type FeeEarnings = z.infer<typeof feeEarningsSchema>;
type AuditLog = z.infer<typeof auditLogSchema>;

async function listRows<T>(table: string, select: string, schema: z.ZodType<T>, limit = 10): Promise<T[]> {
  const { data, error } = await createSupabaseServerClient().from(table).select(select).limit(limit);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function listLeveeReports(): Promise<LeveeReport[]> {
  const { data, error } = await createSupabaseServerClient()
    .from('levee_reports')
    .select('levee_id,deceased_full_name,target_amount_cents,deadline,status,pool_size,per_share_amount_cents,collected_amount_cents,outstanding_amount_cents,association_count,remitted_association_count,collection_rate,first_payment_at,latest_payment_at,created_at')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = leveeReportSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function listRecentAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await createSupabaseServerClient()
    .from('audit_logs')
    .select('id,actor_user_id,table_name,record_id,action,changed_columns,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = auditLogSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function personName(firstName: string | null, lastName: string | null, email: string): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName.length > 0 ? fullName : email;
}

function rateLabel(rate: number): string {
  return `${Math.round(rate * 100) / 100}%`;
}

function metadataStatus(metadata: Record<string, unknown>): string | null {
  const before = typeof metadata.status_before === 'string' ? metadata.status_before : null;
  const after = typeof metadata.status_after === 'string' ? metadata.status_after : null;

  if (before === null && after === null) {
    return null;
  }

  return `${before ?? '-'} -> ${after ?? '-'}`;
}

export default async function AdminReportsPage({ params }: AdminReportsPageProps) {
  const currentUser = await requirePlatformAdmin();
  const t = await getTranslations('reports.admin');
  const format = await getFormatter();
  const [levees, breakdown, memberReports, fiscalSummaries, roster, feeEarnings, auditLogs] = await Promise.all([
    listLeveeReports(),
    listRows(
      'levee_association_breakdown',
      'association_name,association_city,association_id,call_status,collected_amount_cents,collection_rate,member_count,outstanding_amount_cents,paid_member_count,partial_member_count,remitted_at,share_count,target_amount_cents,unpaid_member_count',
      leveeAssociationBreakdownSchema,
      12
    ),
    listRows(
      'member_contribution_report',
      'contribution_id,association_name,deceased_full_name,email,first_name,last_name,share_count,amount_due_cents,amount_paid_cents,status,total_payment_history_cents,payment_count',
      memberReportSchema,
      12
    ),
    listRows(
      'member_fiscal_summary_report',
      'user_id,association_name,fiscal_year,total_contributed_cents,payment_count,latest_payment_at',
      fiscalSummarySchema,
      8
    ),
    listRows('admin_member_roster_report', 'association_name,email,first_name,last_name,role,status,share_count', rosterSchema, 12),
    listRows('admin_fee_earnings_report', 'association_name,admin_email,admin_first_name,admin_last_name,accrued_amount_cents,paid_amount_cents,total_amount_cents', feeEarningsSchema, 8),
    listRecentAuditLogs()
  ]);

  const totalCollected = levees.reduce((total, levee) => total + levee.collected_amount_cents, 0);
  const totalTarget = levees.reduce((total, levee) => total + levee.target_amount_cents, 0);
  const totalShares = roster.reduce((total, row) => total + row.share_count, 0);
  const totalFees = feeEarnings.reduce((total, row) => total + row.total_amount_cents, 0);

  return (
    <AdminWorkspaceShell activeItem="reports" locale={params.locale} title={t('title')} userEmail={currentUser.user.email}>
      <section className="grid gap-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <dl className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card md:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-secondary">{t('collectedLabel')}</dt>
              <dd className="mt-1 text-xl font-semibold text-heading">{format.number(totalCollected / 100, { currency: 'CAD', style: 'currency' })}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-secondary">{t('collectionRateLabel')}</dt>
              <dd className="mt-1 text-xl font-semibold text-heading">{totalTarget <= 0 ? '0%' : rateLabel((totalCollected / totalTarget) * 100)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-secondary">{t('feeEarningsLabel')}</dt>
              <dd className="mt-1 text-xl font-semibold text-heading">{format.number(totalFees / 100, { currency: 'CAD', style: 'currency' })}</dd>
            </div>
          </dl>
        </div>

        <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <BarChart3 aria-hidden="true" className="mt-1 text-brand-strong" size={20} />
            <div>
              <h2 className="text-xl font-semibold text-heading">{t('leveeReportsTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{t('leveeReportsDescription')}</p>
            </div>
          </div>
          {levees.length === 0 ? (
            <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyLevees')}</div>
          ) : (
            <div className="grid gap-3">
              {levees.map((levee) => (
                <article className="grid gap-3 rounded-sm border border-border bg-sunken p-4" key={levee.levee_id}>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">{t(`leveeStatuses.${levee.status}`)}</p>
                      <h3 className="mt-1 text-lg font-semibold text-heading">{levee.deceased_full_name}</h3>
                    </div>
                    <p className="rounded-sm bg-info-bg px-3 py-2 text-sm font-medium text-info">{rateLabel(levee.collection_rate)}</p>
                  </div>
                  <dl className="grid gap-3 text-sm md:grid-cols-5">
                    <div>
                      <dt className="font-medium text-secondary">{t('targetLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.number(levee.target_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('collectedLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.number(levee.collected_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('deadlineLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.dateTime(new Date(levee.deadline), { dateStyle: 'medium' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('timelineLabel')}</dt>
                      <dd className="mt-1 text-heading">{levee.first_payment_at === null ? t('notAvailable') : format.dateTime(new Date(levee.first_payment_at), { dateStyle: 'medium' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('associationsLabel')}</dt>
                      <dd className="mt-1 font-mono text-heading">
                        {levee.remitted_association_count}/{levee.association_count}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
          <h2 className="text-xl font-semibold text-heading">{t('associationBreakdownTitle')}</h2>
          {breakdown.length === 0 ? (
            <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyBreakdown')}</div>
          ) : (
            <div className="grid gap-3">
              {breakdown.map((row) => (
                <div className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-5" key={`${row.association_id}:${row.target_amount_cents}:${row.share_count}`}>
                  <div>
                    <p className="font-semibold text-heading">{row.association_name}</p>
                    <p className="mt-1 text-secondary">{row.association_city}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('sharesLabel')}</p>
                    <p className="mt-1 font-mono text-heading">{row.share_count}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('collectedLabel')}</p>
                    <p className="mt-1 text-heading">{format.number(row.collected_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('membersLabel')}</p>
                    <p className="mt-1 text-heading">
                      {row.paid_member_count}/{row.member_count}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('collectionRateLabel')}</p>
                    <p className="mt-1 text-heading">{rateLabel(row.collection_rate)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <UsersRound aria-hidden="true" className="mt-1 text-brand-strong" size={20} />
            <div>
              <h2 className="text-xl font-semibold text-heading">{t('memberReportsTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{t('memberReportsDescription')}</p>
            </div>
          </div>
          {memberReports.length === 0 ? (
            <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyMembers')}</div>
          ) : (
            <div className="grid gap-3">
              {memberReports.map((member) => (
                <div className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-5" key={member.contribution_id}>
                  <div>
                    <p className="font-semibold text-heading">{personName(member.first_name, member.last_name, member.email)}</p>
                    <p className="mt-1 text-secondary">{member.association_name}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('leveeLabel')}</p>
                    <p className="mt-1 text-heading">{member.deceased_full_name}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('sharesLabel')}</p>
                    <p className="mt-1 font-mono text-heading">{member.share_count}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('paidLabel')}</p>
                    <p className="mt-1 text-heading">{format.number(member.amount_paid_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('statusLabel')}</p>
                    <p className="mt-1 text-heading">{t(`contributionStatuses.${member.status}`)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
            <h2 className="text-xl font-semibold text-heading">{t('fiscalSummaryTitle')}</h2>
            {fiscalSummaries.length === 0 ? (
              <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyFiscal')}</div>
            ) : (
              <div className="grid gap-3">
                {fiscalSummaries.map((summary) => (
                  <div className="grid gap-2 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-3" key={`${summary.user_id}:${summary.association_name}:${summary.fiscal_year}`}>
                    <p className="font-semibold text-heading">{summary.association_name}</p>
                    <p className="text-secondary">{summary.fiscal_year}</p>
                    <p className="text-heading">{format.number(summary.total_contributed_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
            <h2 className="text-xl font-semibold text-heading">{t('rosterTitle')}</h2>
            <p className="text-sm text-secondary">{t('totalSharesValue', { count: totalShares })}</p>
            {roster.length === 0 ? (
              <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyRoster')}</div>
            ) : (
              <div className="grid gap-3">
                {roster.map((row) => (
                  <div className="grid gap-2 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-4" key={`${row.association_name}:${row.email}:${row.role}`}>
                    <p className="font-semibold text-heading">{personName(row.first_name, row.last_name, row.email)}</p>
                    <p className="text-secondary">{row.association_name}</p>
                    <p className="text-heading">{t(`memberRoles.${row.role}`)}</p>
                    <p className="font-mono text-heading">{row.share_count}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <ReceiptText aria-hidden="true" className="mt-1 text-brand-strong" size={20} />
            <div>
              <h2 className="text-xl font-semibold text-heading">{t('feeEarningsTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{t('feeEarningsDescription')}</p>
            </div>
          </div>
          {feeEarnings.length === 0 ? (
            <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyFees')}</div>
          ) : (
            <div className="grid gap-3">
              {feeEarnings.map((row) => (
                <div className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-4" key={`${row.association_name}:${row.admin_email}`}>
                  <p className="font-semibold text-heading">{personName(row.admin_first_name, row.admin_last_name, row.admin_email)}</p>
                  <p className="text-secondary">{row.association_name}</p>
                  <p className="text-heading">{format.number(row.accrued_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                  <p className="text-heading">{format.number(row.total_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <Activity aria-hidden="true" className="mt-1 text-brand-strong" size={20} />
            <div>
              <h2 className="text-xl font-semibold text-heading">{t('auditTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-secondary">{t('auditDescription')}</p>
            </div>
          </div>
          {auditLogs.length === 0 ? (
            <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyAudit')}</div>
          ) : (
            <div className="grid gap-3">
              {auditLogs.map((log) => (
                <div className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-[1fr_140px_1fr_1fr]" key={log.id}>
                  <div>
                    <p className="font-semibold text-heading">
                      {log.table_name} · {log.action}
                    </p>
                    <p className="mt-1 font-mono text-xs text-secondary">{log.record_id ?? t('notAvailable')}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('whenLabel')}</p>
                    <p className="mt-1 text-heading">{format.dateTime(new Date(log.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('actorLabel')}</p>
                    <p className="mt-1 font-mono text-xs text-heading">{log.actor_user_id ?? t('systemActor')}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('changedLabel')}</p>
                    <p className="mt-1 text-heading">{log.changed_columns.length === 0 ? (metadataStatus(log.metadata) ?? t('notAvailable')) : log.changed_columns.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-md border border-border bg-sunken p-5 text-sm leading-6 text-secondary">
          <Clock aria-hidden="true" className="mr-2 inline text-brand-strong" size={16} />
          {t('auditNote')}
        </div>
      </section>
    </AdminWorkspaceShell>
  );
}
