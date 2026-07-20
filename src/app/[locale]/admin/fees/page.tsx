import { getFormatter, getTranslations } from 'next-intl/server';
import { CreditCard, Landmark, ReceiptText } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { AdminFeePayoutForm, AdminFeeSettingsForm } from '@/features/admin-fees';
import type { AdminFeeModel, AdminFeePayoutMethod } from '@/features/admin-fees/admin-fee-types';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const associationSchema = z.object({
  city: z.string(),
  id: z.string().uuid(),
  name: z.string(),
  status: z.string()
});

const settingsSchema = z.object({
  association_id: z.string().uuid(),
  fee_bps: z.number().int(),
  fee_fixed_cents: z.number(),
  fee_model: z.enum(['per_member', 'per_levee']),
  is_enabled: z.boolean(),
  payout_method: z.enum(['manual', 'stripe_connect']),
  stripe_connect_account_id: z.string().nullable()
});

const adminMembershipSchema = z.object({
  association_id: z.string().uuid(),
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

const balanceSchema = z.object({
  accrued_amount_cents: z.number(),
  accrued_fee_count: z.number().int(),
  association_admin_user_id: z.string().uuid(),
  association_id: z.string().uuid(),
  latest_fee_at: z.string().nullable(),
  paid_amount_cents: z.number(),
  pending_payout_amount_cents: z.number(),
  total_amount_cents: z.number()
});

const payoutSchema = z.object({
  amount_cents: z.number(),
  association_admin_user_id: z.string().uuid(),
  association_id: z.string().uuid(),
  created_at: z.string(),
  id: z.string().uuid(),
  method: z.enum(['manual', 'stripe_connect']),
  paid_at: z.string().nullable(),
  status: z.enum(['pending', 'processing', 'paid', 'failed']),
  stripe_transfer_id: z.string().nullable()
});

type AdminFeesPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

type Association = z.infer<typeof associationSchema>;
type AdminMembership = z.infer<typeof adminMembershipSchema>;
type Balance = z.infer<typeof balanceSchema>;
type FeeSettings = z.infer<typeof settingsSchema>;
type FeePayout = z.infer<typeof payoutSchema>;

function adminLabel(membership: AdminMembership): string {
  const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return fullName.length > 0 ? fullName : (user?.email ?? membership.user_id);
}

async function listAssociations(): Promise<Association[]> {
  const { data, error } = await createSupabaseServerClient().from('associations').select('id,name,city,status').order('name', { ascending: true });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = associationSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function listFeeSettings(): Promise<Map<string, FeeSettings>> {
  const { data, error } = await createSupabaseServerClient()
    .from('association_admin_fee_settings')
    .select('association_id,fee_model,fee_bps,fee_fixed_cents,payout_method,stripe_connect_account_id,is_enabled');

  if (error || data === null) {
    return new Map();
  }

  return new Map(
    data.flatMap((row: unknown) => {
      const parsed = settingsSchema.safeParse(row);
      return parsed.success ? [[parsed.data.association_id, parsed.data] as const] : [];
    })
  );
}

async function listAssociationAdmins(): Promise<AdminMembership[]> {
  const { data, error } = await createSupabaseServerClient()
    .from('association_members')
    .select('association_id,user_id,users:user_id(email,first_name,last_name)')
    .eq('role', 'association_admin')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = adminMembershipSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function listBalances(): Promise<Map<string, Balance>> {
  const { data, error } = await createSupabaseServerClient()
    .from('association_admin_fee_balances')
    .select('association_id,association_admin_user_id,accrued_amount_cents,pending_payout_amount_cents,paid_amount_cents,total_amount_cents,accrued_fee_count,latest_fee_at');

  if (error || data === null) {
    return new Map();
  }

  return new Map(
    data.flatMap((row: unknown) => {
      const parsed = balanceSchema.safeParse(row);
      return parsed.success ? [[`${parsed.data.association_id}:${parsed.data.association_admin_user_id}`, parsed.data] as const] : [];
    })
  );
}

async function listRecentPayouts(): Promise<FeePayout[]> {
  const { data, error } = await createSupabaseServerClient()
    .from('association_admin_fee_payouts')
    .select('id,association_id,association_admin_user_id,method,status,amount_cents,stripe_transfer_id,paid_at,created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = payoutSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function defaultSettings(associationId: string): FeeSettings {
  return {
    association_id: associationId,
    fee_bps: 250,
    fee_fixed_cents: 0,
    fee_model: 'per_member',
    is_enabled: true,
    payout_method: 'manual',
    stripe_connect_account_id: null
  };
}

export default async function AdminFeesPage({ params }: AdminFeesPageProps) {
  const currentUser = await requirePlatformAdmin();
  const t = await getTranslations('adminFees.admin');
  const format = await getFormatter();
  const [associations, settingsByAssociation, adminMemberships, balancesByAdmin, recentPayouts] = await Promise.all([
    listAssociations(),
    listFeeSettings(),
    listAssociationAdmins(),
    listBalances(),
    listRecentPayouts()
  ]);
  const adminsByAssociation = new Map<string, AdminMembership[]>();

  for (const membership of adminMemberships) {
    adminsByAssociation.set(membership.association_id, [...(adminsByAssociation.get(membership.association_id) ?? []), membership]);
  }

  const totalAccrued = [...balancesByAdmin.values()].reduce((total, balance) => total + balance.accrued_amount_cents, 0);
  const totalPaid = [...balancesByAdmin.values()].reduce((total, balance) => total + balance.paid_amount_cents, 0);

  return (
    <AdminWorkspaceShell activeItem="fees" locale={params.locale} title={t('title')} userEmail={currentUser.user.email}>
      <section className="grid gap-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <dl className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card md:grid-cols-2">
            <div>
              <dt className="flex items-center gap-2 text-sm font-medium text-secondary">
                <ReceiptText aria-hidden="true" size={16} />
                {t('totalAccruedLabel')}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-heading">{format.number(totalAccrued / 100, { currency: 'CAD', style: 'currency' })}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-sm font-medium text-secondary">
                <Landmark aria-hidden="true" size={16} />
                {t('totalPaidLabel')}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-heading">{format.number(totalPaid / 100, { currency: 'CAD', style: 'currency' })}</dd>
            </div>
          </dl>
        </div>

        {associations.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('emptyAssociations')}</div>
        ) : (
          <div className="grid gap-5">
            {associations.map((association) => {
              const settings = settingsByAssociation.get(association.id) ?? defaultSettings(association.id);
              const admins = adminsByAssociation.get(association.id) ?? [];

              return (
                <article className="grid gap-5 rounded-md border border-border bg-card p-5 shadow-card" key={association.id}>
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">{association.status}</p>
                      <h2 className="mt-1 text-2xl font-semibold text-heading">{association.name}</h2>
                      <p className="mt-1 text-sm text-secondary">{association.city}</p>
                    </div>
                    <p className="inline-flex w-fit items-center gap-2 rounded-sm bg-info-bg px-3 py-2 text-sm font-medium text-info">
                      <CreditCard aria-hidden="true" size={16} />
                      {t(`payoutMethods.${settings.payout_method}`)}
                    </p>
                  </div>

                  <AdminFeeSettingsForm
                    associationId={association.id}
                    feeBps={settings.fee_bps}
                    feeFixedCents={settings.fee_fixed_cents}
                    feeModel={settings.fee_model as AdminFeeModel}
                    isEnabled={settings.is_enabled}
                    locale={params.locale}
                    payoutMethod={settings.payout_method as AdminFeePayoutMethod}
                    stripeConnectAccountId={settings.stripe_connect_account_id}
                  />

                  <section className="grid gap-3 rounded-sm border border-border bg-sunken p-4">
                    <div>
                      <h3 className="text-lg font-semibold text-heading">{t('balancesTitle')}</h3>
                      <p className="mt-1 text-sm leading-6 text-secondary">{t('balancesDescription')}</p>
                    </div>
                    {admins.length === 0 ? (
                      <div className="rounded-sm border border-border bg-card p-4 text-sm text-secondary">{t('emptyAdmins')}</div>
                    ) : (
                      <div className="grid gap-3">
                        {admins.map((admin) => {
                          const balance =
                            balancesByAdmin.get(`${association.id}:${admin.user_id}`) ??
                            ({
                              accrued_amount_cents: 0,
                              accrued_fee_count: 0,
                              association_admin_user_id: admin.user_id,
                              association_id: association.id,
                              latest_fee_at: null,
                              paid_amount_cents: 0,
                              pending_payout_amount_cents: 0,
                              total_amount_cents: 0
                            } satisfies Balance);

                          return (
                            <div className="grid gap-4 rounded-sm border border-border bg-card p-4 lg:grid-cols-[1fr_2fr_auto]" key={`${association.id}:${admin.user_id}`}>
                              <div>
                                <p className="font-semibold text-heading">{adminLabel(admin)}</p>
                                <p className="mt-1 font-mono text-xs text-secondary">{admin.user_id}</p>
                              </div>
                              <dl className="grid gap-3 text-sm md:grid-cols-4">
                                <div>
                                  <dt className="font-medium text-secondary">{t('accruedLabel')}</dt>
                                  <dd className="mt-1 text-heading">{format.number(balance.accrued_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium text-secondary">{t('feeCountLabel')}</dt>
                                  <dd className="mt-1 font-mono text-heading">{balance.accrued_fee_count}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium text-secondary">{t('paidLabel')}</dt>
                                  <dd className="mt-1 text-heading">{format.number(balance.paid_amount_cents / 100, { currency: 'CAD', style: 'currency' })}</dd>
                                </div>
                                <div>
                                  <dt className="font-medium text-secondary">{t('latestFeeLabel')}</dt>
                                  <dd className="mt-1 text-heading">
                                    {balance.latest_fee_at === null ? t('notAvailable') : format.dateTime(new Date(balance.latest_fee_at), { dateStyle: 'medium', timeStyle: 'short' })}
                                  </dd>
                                </div>
                              </dl>
                              <AdminFeePayoutForm
                                accruedAmountCents={balance.accrued_amount_cents}
                                associationAdminUserId={admin.user_id}
                                associationId={association.id}
                                disabled={settings.payout_method === 'stripe_connect' && settings.stripe_connect_account_id === null}
                                locale={params.locale}
                                method={settings.payout_method as AdminFeePayoutMethod}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </article>
              );
            })}
          </div>
        )}

        <section className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
          <div>
            <h2 className="text-xl font-semibold text-heading">{t('recentPayoutsTitle')}</h2>
            <p className="mt-1 text-sm leading-6 text-secondary">{t('recentPayoutsDescription')}</p>
          </div>
          {recentPayouts.length === 0 ? (
            <div className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyPayouts')}</div>
          ) : (
            <div className="grid gap-3">
              {recentPayouts.map((payout) => (
                <div className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-5" key={payout.id}>
                  <div>
                    <p className="font-medium text-secondary">{t('amountLabel')}</p>
                    <p className="mt-1 text-heading">{format.number(payout.amount_cents / 100, { currency: 'CAD', style: 'currency' })}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('payoutMethodLabel')}</p>
                    <p className="mt-1 text-heading">{t(`payoutMethods.${payout.method}`)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('statusLabel')}</p>
                    <p className="mt-1 text-heading">{t(`payoutStatuses.${payout.status}`)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('createdAtLabel')}</p>
                    <p className="mt-1 text-heading">{format.dateTime(new Date(payout.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div>
                    <p className="font-medium text-secondary">{t('stripeTransferLabel')}</p>
                    <p className="mt-1 font-mono text-xs text-heading">{payout.stripe_transfer_id ?? t('notAvailable')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </AdminWorkspaceShell>
  );
}
