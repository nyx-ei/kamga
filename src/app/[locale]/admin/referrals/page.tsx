import { getFormatter, getTranslations } from 'next-intl/server';
import { Link2 } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { ReferralCopyButton } from '@/features/referrals/components/ReferralCopyButton';
import { ReferralGeneratorForm } from '@/features/referrals/components/ReferralGeneratorForm';
import { ReferralSettingsForm } from '@/features/referrals/components/ReferralSettingsForm';
import type { Locale } from '@/i18n/routing';
import { requirePlatformAdmin } from '@/lib/auth';
import { buildReferralUrl } from '@/lib/referrals/tokens';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const activeAssociationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string(),
  allow_member_referrals: z.boolean()
});

const referralTokenSchema = z.object({
  id: z.string().uuid(),
  token: z.string(),
  association_id: z.string().uuid(),
  created_at: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable(),
  used_by: z.string().uuid().nullable(),
  associations: z.object({
    name: z.string()
  })
});

type AdminReferralsPageProps = {
  params: {
    locale: Locale;
  };
};

type ActiveAssociation = z.infer<typeof activeAssociationSchema>;
type ReferralToken = z.infer<typeof referralTokenSchema>;

type ReferralTokenStatus = 'active' | 'expired' | 'used';

function referralTokenStatus(token: ReferralToken): ReferralTokenStatus {
  if (token.used_by !== null || token.used_at !== null) {
    return 'used';
  }

  if (new Date(token.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }

  return 'active';
}

function statusClassName(status: ReferralTokenStatus): string {
  switch (status) {
    case 'active':
      return 'bg-positive-bg text-positive';
    case 'expired':
      return 'bg-warning-bg text-warning';
    case 'used':
      return 'bg-info-bg text-info';
  }
}

async function listActiveAssociations(): Promise<ActiveAssociation[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('associations')
    .select('id,name,city,allow_member_referrals')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = activeAssociationSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function listReferralTokens(): Promise<ReferralToken[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('referral_tokens')
    .select('id,token,association_id,created_at,expires_at,used_at,used_by,associations!inner(name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = referralTokenSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export default async function AdminReferralsPage({ params }: AdminReferralsPageProps) {
  const currentUser = await requirePlatformAdmin();

  const t = await getTranslations('referrals.admin');
  const format = await getFormatter();
  const associations = await listActiveAssociations();
  const referralTokens = await listReferralTokens();

  return (
    <AdminWorkspaceShell activeItem="referrals" locale={params.locale} title={t('title')} userEmail={currentUser.user.email}>
      <section className="grid max-w-6xl gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
        </div>

        {associations.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('noActiveAssociations')}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="grid gap-4">
              <ReferralGeneratorForm associations={associations.map((association) => ({ id: association.id, name: association.name }))} locale={params.locale} />
              <div className="grid gap-3 rounded-md border border-border bg-sunken p-5">
                <h2 className="text-lg font-semibold text-heading">{t('settingsTitle')}</h2>
                {associations.map((association) => (
                  <article className="grid gap-3 rounded-sm border border-border bg-raised p-4" key={association.id}>
                    <div>
                      <h3 className="font-semibold text-heading">{association.name}</h3>
                      <p className="text-sm text-secondary">{association.city}</p>
                    </div>
                    <ReferralSettingsForm
                      allowMemberReferrals={association.allow_member_referrals}
                      associationId={association.id}
                      locale={params.locale}
                    />
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-4 rounded-md border border-border bg-sunken p-5">
              <div className="flex items-center gap-2">
                <Link2 aria-hidden="true" className="text-muted" size={18} />
                <h2 className="text-lg font-semibold text-heading">{t('tokensTitle')}</h2>
              </div>
              {referralTokens.length === 0 ? (
                <p className="text-sm leading-6 text-secondary">{t('emptyTokens')}</p>
              ) : (
                <div className="grid gap-3">
                  {referralTokens.map((token) => {
                    const status = referralTokenStatus(token);
                    const referralUrl = buildReferralUrl(params.locale, token.token);

                    return (
                      <article className="grid gap-3 rounded-sm border border-border bg-raised p-4" key={token.id}>
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div className="min-w-0 space-y-2">
                            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClassName(status)}`}>
                              {t(`statuses.${status}`)}
                            </span>
                            <h3 className="font-semibold text-heading">{token.associations.name}</h3>
                            <p className="break-all font-mono text-xs text-secondary">{referralUrl}</p>
                          </div>
                          <ReferralCopyButton value={referralUrl} />
                        </div>
                        <dl className="grid gap-2 text-xs text-secondary md:grid-cols-2">
                          <div>
                            <dt className="font-medium text-muted">{t('createdAtLabel')}</dt>
                            <dd>{format.dateTime(new Date(token.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-muted">{t('expiresAtLabel')}</dt>
                            <dd>{format.dateTime(new Date(token.expires_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}
