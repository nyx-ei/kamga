import { getFormatter, getTranslations } from 'next-intl/server';
import { Building2, Info, LogIn } from 'lucide-react';
import { z } from 'zod';

import { AssociationWorkspaceShell } from '@/components/kamga/MockupShell';
import { AssociationRegistrationForm } from '@/features/associations/components/AssociationRegistrationForm';
import { ClaimAssociationForm } from '@/features/associations/components/ClaimAssociationForm';
import { ReferralBanner } from '@/features/registration/components/ReferralBanner';
import { ReferralInvalid } from '@/features/registration/components/ReferralInvalid';
import { RegistrationForm } from '@/features/registration/components/RegistrationForm';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth';
import { validateReferralToken } from '@/lib/referrals/tokens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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
    action: 'Claim this listing',
    authorized: "I am authorized to manage this association's listing.",
    badge: 'Claim your listing',
    claimedDescription: 'This association is already claimed. Open the public profile or contact a platform administrator if this looks wrong.',
    claimedTitle: 'Listing already claimed',
    contactEmailLabel: 'Association contact email on file',
    contactEmailPlaceholder: 'admin@example.org',
    footnote: "On success, you can edit the record and manage what's public. Provenance stays invisible to members.",
    invalidDescription: 'This association is not available for claim. It may be inactive, missing, or already under review.',
    invalidTitle: 'Claim unavailable',
    notMine: 'Not my association',
    proveDescription: 'Enter the registry number and the private contact email already attached to this record. Kamga validates them without showing private data publicly.',
    proveTitle: 'Prove you control this association',
    registryLabel: 'Registry number (NEQ / federal)',
    registryPlaceholder: '1169920034',
    selectDescription: 'You are claiming the existing public record below. Successful claims create an active association-admin role for your account.',
    selectTitle: 'Existing association',
    signInAction: 'Sign in to claim',
    signInDescription: 'Create or open your Kamga account before claiming this association listing.',
    signInTitle: 'Sign-in required',
    submitting: 'Claiming...',
    title: 'Confirm you manage this association',
    errors: {
      'KMG-AUTH-401': 'Sign in before claiming this listing.',
      'KMG-CL-001': 'Check the registry number, contact email, and authorization checkbox.',
      'KMG-CL-403': 'The registry number or contact email does not match the private record. The listing has been queued for admin review.',
      'KMG-CL-404': 'This active association could not be found.',
      'KMG-CL-409': 'This association has already been claimed or locked.',
      'KMG-CL-422': 'This listing does not have enough private registry/contact data for automatic claim. It has been queued for admin review.',
      'KMG-SYS-000': 'The listing could not be claimed. Try again or contact support.'
    }
  },
  fr: {
    action: 'Revendiquer cette fiche',
    authorized: 'Je suis autorise a gerer la fiche de cette association.',
    badge: 'Revendication',
    claimedDescription: 'Cette association est deja revendiquee. Ouvrez la fiche publique ou contactez un administrateur plateforme si cela semble incorrect.',
    claimedTitle: 'Fiche deja revendiquee',
    contactEmailLabel: 'Courriel de contact associe a la fiche',
    contactEmailPlaceholder: 'admin@example.org',
    footnote: 'Apres validation, vous pourrez modifier la fiche et gerer les informations publiques. La provenance reste invisible aux membres.',
    invalidDescription: 'Cette association n est pas disponible pour revendication. Elle peut etre inactive, introuvable ou deja en revue.',
    invalidTitle: 'Revendication indisponible',
    notMine: 'Ce n est pas mon association',
    proveDescription: 'Saisissez le numero de registre et le courriel prive deja rattaches a cette fiche. Kamga les valide sans afficher de donnees privees publiquement.',
    proveTitle: 'Prouvez que vous controlez cette association',
    registryLabel: 'Numero de registre (NEQ / federal)',
    registryPlaceholder: '1169920034',
    selectDescription: 'Vous revendiquez la fiche publique existante ci-dessous. Une revendication reussie cree un role admin association actif pour votre compte.',
    selectTitle: 'Association existante',
    signInAction: 'Se connecter pour revendiquer',
    signInDescription: 'Creez ou ouvrez votre compte Kamga avant de revendiquer cette fiche association.',
    signInTitle: 'Connexion requise',
    submitting: 'Revendication...',
    title: 'Confirmez que vous gerez cette association',
    errors: {
      'KMG-AUTH-401': 'Connectez-vous avant de revendiquer cette fiche.',
      'KMG-CL-001': 'Verifiez le numero de registre, le courriel de contact et la case d autorisation.',
      'KMG-CL-403': 'Le numero de registre ou le courriel ne correspond pas a la fiche privee. La fiche a ete placee en revue admin.',
      'KMG-CL-404': 'Cette association active est introuvable.',
      'KMG-CL-409': 'Cette association est deja revendiquee ou verrouillee.',
      'KMG-CL-422': 'Cette fiche ne contient pas assez de donnees privees de registre/contact pour une revendication automatique. Elle a ete placee en revue admin.',
      'KMG-SYS-000': 'La fiche n a pas pu etre revendiquee. Reessayez ou contactez le support.'
    }
  }
} as const;

const claimAssociationSchema = z.object({
  city: z.string(),
  claim_status: z.enum(['unclaimed', 'claimed', 'claim_pending', 'claim_locked']),
  display_name: z.string(),
  id: z.string().uuid(),
  province: z.string(),
  verification_status: z.enum(['unverified', 'verified', 'needs_review'])
});

type ClaimAssociation = z.infer<typeof claimAssociationSchema>;

async function findClaimAssociation(associationId: string | undefined): Promise<ClaimAssociation | null> {
  const parsed = z.string().uuid().safeParse(associationId);

  if (!parsed.success) {
    return null;
  }

  const { data, error } = await createSupabaseAdminClient()
    .from('public_association_directory')
    .select('id,display_name,city,province,verification_status,claim_status')
    .eq('id', parsed.data)
    .maybeSingle();

  if (error || data === null) {
    return null;
  }

  const association = claimAssociationSchema.safeParse(data);
  return association.success ? association.data : null;
}
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
    const association = await findClaimAssociation(searchParams.claim);

    return (
      <AssociationWorkspaceShell locale={params.locale}>
        <section className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase text-[#3454b8]">{claim.badge}</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-heading">{claim.title}</h1>

          {association === null ? (
            <article className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
              <h2 className="text-2xl font-semibold text-heading">{claim.invalidTitle}</h2>
              <p className="mt-3 text-base leading-7 text-secondary">{claim.invalidDescription}</p>
              <Link className="mt-6 inline-flex items-center rounded-sm px-5 py-3 text-sm font-semibold text-brand" href="/">
                {claim.notMine}
              </Link>
            </article>
          ) : (
            <>
              <article className="mt-8 flex gap-5 rounded-md border border-border bg-card p-8 shadow-card">
                <span className="grid size-14 place-items-center rounded-md bg-[#f1f4ff] text-[#3454b8]">
                  <Building2 aria-hidden="true" size={28} />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold text-heading">{claim.selectTitle}</h2>
                  <p className="mt-2 text-secondary">{claim.selectDescription}</p>
                  <p className="mt-5 text-xl font-semibold text-heading">{association.display_name}</p>
                  <p className="mt-1 text-sm text-secondary">
                    {association.city}, {association.province}
                  </p>
                </div>
              </article>

              {association.claim_status !== 'unclaimed' ? (
                <article className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
                  <h2 className="text-2xl font-semibold text-heading">{claim.claimedTitle}</h2>
                  <p className="mt-3 text-base leading-7 text-secondary">{claim.claimedDescription}</p>
                </article>
              ) : currentUser === null ? (
                <article className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
                  <div className="flex flex-col justify-center gap-4">
                    <LogIn aria-hidden="true" className="text-muted" size={28} />
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-heading">{claim.signInTitle}</h2>
                      <p className="text-sm leading-6 text-secondary">{claim.signInDescription}</p>
                    </div>
                    <Link
                      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-heading shadow-card transition hover:bg-brand-strong"
                      href={{ pathname: '/auth/login', query: { next: '/' + params.locale + '/register?claim=' + association.id } }}
                    >
                      <LogIn aria-hidden="true" size={16} />
                      {claim.signInAction}
                    </Link>
                  </div>
                </article>
              ) : (
                <article className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
                  <h2 className="text-2xl font-semibold text-heading">{claim.proveTitle}</h2>
                  <p className="mt-3 text-base leading-7 text-secondary">{claim.proveDescription}</p>
                  <div className="mt-7 flex items-center gap-4 rounded-sm border border-border bg-sunken px-6 py-5 text-secondary">
                    <Info aria-hidden="true" size={24} />
                    <span className="font-medium">{claim.footnote}</span>
                  </div>
                  <div className="mt-7">
                    <ClaimAssociationForm associationId={association.id} copy={claim} locale={params.locale} />
                  </div>
                </article>
              )}
            </>
          )}
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
