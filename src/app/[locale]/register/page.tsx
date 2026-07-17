import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2, CheckCircle2, LogIn, Mail, ShieldCheck } from 'lucide-react';

import { AssociationWorkspaceShell } from '@/components/kamga/MockupShell';
import { AssociationRegistrationForm } from '@/features/associations/components/AssociationRegistrationForm';
import { ReferralBanner } from '@/features/registration/components/ReferralBanner';
import { ReferralInvalid } from '@/features/registration/components/ReferralInvalid';
import { RegistrationForm } from '@/features/registration/components/RegistrationForm';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth';
import { validateReferralToken } from '@/lib/referrals/tokens';

type RegisterPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    claim?: string;
    ref?: string;
  };
};

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const t = await getTranslations('associations.registration');
  const referralT = await getTranslations('referrals.registration');
  const format = await getFormatter();
  const currentUser = await getCurrentUser();
  const referralToken = searchParams.ref;
  const isClaimFlow = typeof searchParams.claim === 'string';

  if (referralToken !== undefined) {
    const validation = await validateReferralToken(referralToken);

    return (
      <main className="min-h-screen bg-page px-6 py-10 text-body">
        <section className="mx-auto grid max-w-5xl gap-6 rounded-md border border-border bg-card p-8 shadow-card">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{referralT('badge')}</p>
            <h1 className="text-3xl font-semibold leading-tight text-heading">{referralT('title')}</h1>
            <p className="text-base leading-7 text-secondary">{referralT('description')}</p>
          </div>

          {validation.ok ? (
            <>
              <ReferralBanner
                associationName={validation.associationName}
                expiresAtLabel={referralT('expiresAt', {
                  date: format.dateTime(new Date(validation.expiresAt), { dateStyle: 'medium', timeStyle: 'short' })
                })}
                referredByLabel={referralT('referredByLabel')}
                title={referralT('bannerTitle', {
                  association: validation.associationName,
                  name: validation.referredByName.length > 0 ? validation.referredByName : referralT('unknownReferrer')
                })}
              />
              <RegistrationForm associationName={validation.associationName} locale={params.locale} referralToken={validation.token} />
            </>
          ) : (
            <ReferralInvalid code={validation.code} message={referralT(`errors.${validation.code}`)} />
          )}
        </section>
      </main>
    );
  }

  if (isClaimFlow) {
    return (
      <AssociationWorkspaceShell activeTab="claim" locale={params.locale}>
        <section className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase text-[#3454b8]">Claim your listing</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-heading">Confirm you manage this association</h1>

          <article className="mt-8 flex gap-5 rounded-md border border-border bg-card p-8 shadow-card">
            <span className="grid size-14 place-items-center rounded-md bg-[#f1f4ff] text-[#3454b8]">
              <Building2 aria-hidden="true" size={28} />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-heading">RPN Mile End Collectif</h2>
              <p className="mt-2 text-secondary">Mile End, Montreal, QC</p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">Unclaimed</span>
                <span className="rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">Entered by RPN staff</span>
              </div>
            </div>
          </article>

          <article className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold text-heading">Prove you control this association</h2>
            <p className="mt-3 text-base leading-7 text-secondary">
              Two checks: a registry-number match plus confirmation at the association&apos;s contact email on file.
            </p>
            <label className="mt-7 grid gap-2 text-sm font-semibold text-heading">
              Registry number (NEQ / federal)
              <input className="h-12 rounded-sm border border-input bg-card px-4 text-base text-heading shadow-card" defaultValue="1169920034" />
            </label>
            <div className="mt-7 flex items-center gap-4 rounded-sm border border-positive/30 bg-positive-bg px-6 py-5 text-positive">
              <CheckCircle2 aria-hidden="true" size={24} />
              <span className="font-medium">Registry number matches the record on file.</span>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-sm border border-border bg-sunken px-6 py-5 text-secondary">
              <span className="inline-flex items-center gap-3">
                <Mail aria-hidden="true" size={22} />
                Confirmation code sent to c*****@mileend-rpn.ca
              </span>
              <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">Awaiting</span>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-heading">
              Confirmation code
              <input className="h-12 rounded-sm border border-input bg-card px-4 font-mono text-base text-heading shadow-card" placeholder="6-digit code" />
            </label>
            <label className="mt-6 inline-flex items-center gap-3 text-sm font-medium text-heading">
              <input className="size-5 accent-brand" defaultChecked type="checkbox" />
              I am authorized to manage this association&apos;s listing.
            </label>
            <div className="mt-7 flex gap-5">
              <button className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card" type="button">
                <ShieldCheck aria-hidden="true" size={16} />
                Claim this listing
              </button>
              <Link className="inline-flex items-center rounded-sm px-5 py-3 text-sm font-semibold text-brand" href="/register">
                Not my association
              </Link>
            </div>
          </article>
          <p className="mt-8 text-sm text-secondary">On success, you can edit the record and manage what&apos;s public. Provenance stays invisible to members.</p>
        </section>
      </AssociationWorkspaceShell>
    );
  }

  return (
    <AssociationWorkspaceShell activeTab="self-registration" locale={params.locale}>
      <section className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase text-[#3454b8]">{t('badge')}</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-heading">{t('title')}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>

        <div className="mt-10 rounded-md border border-border bg-card p-8 shadow-card">
          <div className="flex items-center gap-5">
            <span className="grid size-9 place-items-center rounded-full bg-[#4d67c7] text-white">OK</span>
            <span className="font-semibold text-secondary">Identity & location</span>
            <span className="h-px flex-1 bg-border" />
            <span className="grid size-9 place-items-center rounded-full bg-blue-900 text-white">2</span>
            <span className="font-semibold text-heading">Verify legitimacy</span>
            <span className="h-px flex-1 bg-border" />
            <span className="grid size-9 place-items-center rounded-full bg-[#eef1f7] text-secondary">3</span>
            <span className="font-semibold text-secondary">Choose what&apos;s public</span>
          </div>
        </div>

        <div className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
          {currentUser === null ? (
            <div className="flex flex-col justify-center gap-4">
              <Building2 aria-hidden="true" className="text-muted" size={28} />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-heading">{t('authRequiredTitle')}</h2>
                <p className="text-sm leading-6 text-secondary">{t('authRequiredDescription')}</p>
              </div>
              <Link
                className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-heading shadow-card transition hover:bg-brand-strong"
                href={{ pathname: '/auth/login', query: { next: `/${params.locale}/register` } }}
              >
                <LogIn aria-hidden="true" size={16} />
                {t('authRequiredAction')}
              </Link>
            </div>
          ) : (
            <AssociationRegistrationForm locale={params.locale} />
          )}
        </div>
      </section>
    </AssociationWorkspaceShell>
  );
}
