import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2, LogIn } from 'lucide-react';

import { AssociationRegistrationForm } from '@/features/associations/components/AssociationRegistrationForm';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth';
import { validateReferralToken } from '@/lib/referrals/tokens';

type RegisterPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    ref?: string;
  };
};

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const t = await getTranslations('associations.registration');
  const referralT = await getTranslations('referrals.registration');
  const format = await getFormatter();
  const currentUser = await getCurrentUser();
  const referralToken = searchParams.ref;

  if (referralToken !== undefined) {
    const validation = await validateReferralToken(referralToken);

    return (
      <main className="min-h-screen bg-page px-6 py-10 text-body">
        <section className="mx-auto grid max-w-4xl gap-6 rounded-md border border-border bg-card p-8 shadow-card">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{referralT('badge')}</p>
            <h1 className="text-3xl font-semibold leading-tight text-heading">{referralT('title')}</h1>
            <p className="text-base leading-7 text-secondary">{referralT('description')}</p>
          </div>

          {validation.ok ? (
            <div className="grid gap-4 rounded-md border border-border bg-sunken p-5">
              <div>
                <p className="text-sm font-medium text-secondary">{referralT('associationLabel')}</p>
                <h2 className="mt-1 text-xl font-semibold text-heading">{validation.associationName}</h2>
              </div>
              <p className="text-sm leading-6 text-secondary">
                {referralT('expiresAt', { date: format.dateTime(new Date(validation.expiresAt), { dateStyle: 'medium', timeStyle: 'short' }) })}
              </p>
              {currentUser === null ? (
                <Link
                  className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
                  href={{ pathname: '/auth/login', query: { next: `/${params.locale}/register?ref=${validation.token}` } }}
                >
                  <LogIn aria-hidden="true" size={16} />
                  {referralT('signInAction')}
                </Link>
              ) : (
                <p className="rounded-sm border border-border bg-info-bg px-4 py-3 text-sm font-medium text-info">{referralT('readyMessage')}</p>
              )}
            </div>
          ) : (
            <p className="rounded-md border border-border bg-negative-bg p-5 text-sm font-medium text-negative">
              {referralT(`errors.${validation.code}`)} ({validation.code})
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto grid max-w-5xl gap-8 rounded-md border border-border bg-card p-8 shadow-card lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
            <p className="text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <div className="rounded-sm border border-border bg-sunken p-4 text-sm leading-6 text-secondary">{t('reviewNotice')}</div>
        </div>

        {currentUser === null ? (
          <div className="flex flex-col justify-center gap-4 rounded-md border border-border bg-sunken p-6">
            <Building2 aria-hidden="true" className="text-muted" size={28} />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-heading">{t('authRequiredTitle')}</h2>
              <p className="text-sm leading-6 text-secondary">{t('authRequiredDescription')}</p>
            </div>
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
              href={{ pathname: '/auth/login', query: { next: `/${params.locale}/register` } }}
            >
              <LogIn aria-hidden="true" size={16} />
              {t('authRequiredAction')}
            </Link>
          </div>
        ) : (
          <AssociationRegistrationForm locale={params.locale} />
        )}
      </section>
    </main>
  );
}
