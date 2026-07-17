import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2, Info, LogIn, Mail, ShieldCheck } from 'lucide-react';

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

const claimCopy = {
  en: {
    badge: 'Claim your listing',
    title: 'Confirm you manage this association',
    selectTitle: 'Select an existing association',
    selectDescription: 'Claim requests are not connected to the backend yet.',
    unavailable: 'Unavailable',
    placeholder: 'Design placeholder only',
    proveTitle: 'Prove you control this association',
    proveDescription:
      'This screen preserves the approved product layout. The claim backend, association selector and email-code verification still need a dedicated ticket.',
    registryLabel: 'Registry number (NEQ / federal)',
    registryPlaceholder: 'Available after claim flow is implemented',
    registryDisabled: 'Registry matching is disabled until a real verification service is added.',
    emailDisabled: 'Email confirmation will be sent by the future claim workflow.',
    disabled: 'Disabled',
    codeLabel: 'Confirmation code',
    codePlaceholder: '6-digit code',
    authorized: "I am authorized to manage this association's listing.",
    action: 'Claim this listing',
    notMine: 'Not my association',
    footnote: "On success, you can edit the record and manage what's public. Provenance stays invisible to members."
  },
  fr: {
    badge: 'Revendication',
    title: 'Confirmez que vous gerez cette association',
    selectTitle: 'Selectionner une association existante',
    selectDescription: "Les demandes de revendication ne sont pas encore connectees au backend.",
    unavailable: 'Indisponible',
    placeholder: 'Placeholder de design uniquement',
    proveTitle: 'Prouvez que vous controlez cette association',
    proveDescription:
      "Cet ecran conserve le layout produit valide. Le backend de revendication, le selecteur d'association et la verification par code email demandent encore un ticket dedie.",
    registryLabel: 'Numero de registre (NEQ / federal)',
    registryPlaceholder: 'Disponible apres implementation du flow de revendication',
    registryDisabled: "La verification du registre est desactivee jusqu'a l'ajout d'un vrai service de verification.",
    emailDisabled: 'La confirmation email sera envoyee par le futur workflow de revendication.',
    disabled: 'Desactive',
    codeLabel: 'Code de confirmation',
    codePlaceholder: 'Code a 6 chiffres',
    authorized: "Je suis autorise a gerer la fiche de cette association.",
    action: 'Revendiquer cette fiche',
    notMine: "Ce n'est pas mon association",
    footnote: 'Apres validation, vous pourrez modifier la fiche et gerer les informations publiques. La provenance reste invisible aux membres.'
  }
} as const;

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const t = await getTranslations('associations.registration');
  const referralT = await getTranslations('referrals.registration');
  const format = await getFormatter();
  const currentUser = await getCurrentUser();
  const referralToken = searchParams.ref;
  const isClaimFlow = typeof searchParams.claim === 'string';
  const claim = claimCopy[params.locale];

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
      <AssociationWorkspaceShell locale={params.locale}>
        <section className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase text-[#3454b8]">{claim.badge}</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-heading">{claim.title}</h1>

          <article className="mt-8 flex gap-5 rounded-md border border-border bg-card p-8 shadow-card">
            <span className="grid size-14 place-items-center rounded-md bg-[#f1f4ff] text-[#3454b8]">
              <Building2 aria-hidden="true" size={28} />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-heading">{claim.selectTitle}</h2>
              <p className="mt-2 text-secondary">{claim.selectDescription}</p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">{claim.unavailable}</span>
                <span className="rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">{claim.placeholder}</span>
              </div>
            </div>
          </article>

          <article className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
            <h2 className="text-2xl font-semibold text-heading">{claim.proveTitle}</h2>
            <p className="mt-3 text-base leading-7 text-secondary">{claim.proveDescription}</p>
            <label className="mt-7 grid gap-2 text-sm font-semibold text-heading">
              {claim.registryLabel}
              <input className="h-12 cursor-not-allowed rounded-sm border border-input bg-sunken px-4 text-base text-muted shadow-card" disabled placeholder={claim.registryPlaceholder} />
            </label>
            <div className="mt-7 flex items-center gap-4 rounded-sm border border-border bg-sunken px-6 py-5 text-secondary">
              <Info aria-hidden="true" size={24} />
              <span className="font-medium">{claim.registryDisabled}</span>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-sm border border-border bg-sunken px-6 py-5 text-secondary">
              <span className="inline-flex items-center gap-3">
                <Mail aria-hidden="true" size={22} />
                {claim.emailDisabled}
              </span>
              <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">{claim.disabled}</span>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-heading">
              {claim.codeLabel}
              <input className="h-12 cursor-not-allowed rounded-sm border border-input bg-sunken px-4 font-mono text-base text-muted shadow-card" disabled placeholder={claim.codePlaceholder} />
            </label>
            <label className="mt-6 inline-flex cursor-not-allowed items-center gap-3 text-sm font-medium text-muted">
              <input className="size-5" disabled type="checkbox" />
              {claim.authorized}
            </label>
            <div className="mt-7 flex gap-5">
              <button className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm bg-[#d8def5] px-5 py-3 text-sm font-semibold text-muted shadow-card" disabled type="button">
                <ShieldCheck aria-hidden="true" size={16} />
                {claim.action}
              </button>
              <Link className="inline-flex items-center rounded-sm px-5 py-3 text-sm font-semibold text-brand" href="/register">
                {claim.notMine}
              </Link>
            </div>
          </article>
          <p className="mt-8 text-sm text-secondary">{claim.footnote}</p>
        </section>
      </AssociationWorkspaceShell>
    );
  }

  return (
    <AssociationWorkspaceShell locale={params.locale}>
      <section className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase text-[#3454b8]">{t('badge')}</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-heading">{t('title')}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>

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
