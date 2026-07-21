import { CheckCircle2, XCircle } from 'lucide-react';

import { AssociationWorkspaceShell } from '@/components/kamga/MockupShell';
import { Link } from '@/i18n/navigation';
import { confirmContactNotificationOptIn } from '@/lib/associations/contact-opt-in';

type ContactOptInConfirmPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    token?: string;
  };
};

const copy = {
  en: {
    action: 'Back to directory',
    badge: 'Contact notifications',
    errors: {
      expired: 'This confirmation link has expired. Ask the association admin or platform team to send a new confirmation email.',
      invalid: 'This confirmation link is invalid. Check that the full link was copied from the email.',
      used: 'This confirmation link has already been used.'
    },
    successDescription: 'Kamga can now send operational notifications to this address. This does not make the address public.',
    successTitle: 'Email confirmed',
    title: 'Confirm association notifications'
  },
  fr: {
    action: 'Retour au répertoire',
    badge: 'Notifications de contact',
    errors: {
      expired: 'Ce lien de confirmation a expiré. Demandez à l’admin association ou à l’équipe plateforme d’envoyer un nouveau courriel de confirmation.',
      invalid: 'Ce lien de confirmation est invalide. Vérifiez que le lien complet a été copié depuis le courriel.',
      used: 'Ce lien de confirmation a déjà été utilisé.'
    },
    successDescription: 'Kamga peut maintenant envoyer les notifications opérationnelles à cette adresse. Cela ne rend pas l’adresse publique.',
    successTitle: 'Courriel confirmé',
    title: 'Confirmer les notifications association'
  }
} as const;

export const dynamic = 'force-dynamic';

export default async function ContactOptInConfirmPage({ params, searchParams }: ContactOptInConfirmPageProps) {
  const result = await confirmContactNotificationOptIn(searchParams.token);
  const t = copy[params.locale];

  return (
    <AssociationWorkspaceShell locale={params.locale}>
      <section className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase text-[#3454b8]">{t.badge}</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-heading">{t.title}</h1>

        <article className="mt-8 rounded-md border border-border bg-card p-8 shadow-card">
          {result.ok ? (
            <div className="flex gap-5">
              <CheckCircle2 aria-hidden="true" className="mt-1 shrink-0 text-positive" size={32} />
              <div>
                <h2 className="text-2xl font-semibold text-heading">{t.successTitle}</h2>
                <p className="mt-3 text-base leading-7 text-secondary">
                  {result.associationName}: {t.successDescription}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-5">
              <XCircle aria-hidden="true" className="mt-1 shrink-0 text-negative" size={32} />
              <div>
                <h2 className="text-2xl font-semibold text-heading">{t.errors[result.code]}</h2>
              </div>
            </div>
          )}

          <Link className="mt-8 inline-flex w-fit items-center rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong" href="/">
            {t.action}
          </Link>
        </article>
      </section>
    </AssociationWorkspaceShell>
  );
}