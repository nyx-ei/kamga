import { z } from 'zod';

import { MemberWorkspaceShell } from '@/components/kamga/MockupShell';
import { AssociationPrivacyRequestForm } from '@/features/associations/components/AssociationPrivacyRequestForm';
import { AssociationRecordManagementForm } from '@/features/associations/components/AssociationRecordManagementForm';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const associationRecordSchema = z.object({
  city: z.string(),
  claim_status: z.enum(['unclaimed', 'claimed', 'claim_pending', 'claim_locked']),
  common_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_notification_opt_in_status: z.enum(['pending', 'confirmed', 'withdrawn']),
  description: z.string().nullable(),
  id: z.string().uuid(),
  official_name: z.string(),
  postal_code: z.string().nullable(),
  primary_language: z.enum(['fr', 'en', 'fr_en']),
  province: z.string(),
  public_contact_email: z.boolean(),
  public_precision: z.enum(['neighbourhood', 'exact']),
  status: z.enum(['pending_review', 'active', 'declined', 'suspended']),
  street_address: z.string().nullable(),
  verification_status: z.enum(['unverified', 'verified', 'needs_review'])
});

const membershipAssociationSchema = z.object({
  associations: z.union([associationRecordSchema, z.array(associationRecordSchema)]).nullable(),
  id: z.string().uuid()
});

type AssociationRecord = z.infer<typeof associationRecordSchema>;

type DashboardAssociationsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

const copy = {
  en: {
    cityLabel: 'City',
    commonNameHelp: 'Displayed when different from the official name.',
    commonNameLabel: 'Common name',
    contactEmailHelp: 'Changing this email sends a new confirmation request. It is never used for notifications before confirmation.',
    contactEmailLabel: 'Private contact email',
    description: 'Edit your claimed association listing. Verification, source and platform status remain controlled by Kamga administrators.',
    descriptionLabel: 'Public description',
    emptyAction: 'Register an association',
    emptyState: 'No claimed association is attached to this account yet.',
    exactPrecisionLabel: 'Exact address',
    languageLabel: 'Primary language',
    nameLabel: 'Official name',
    neighbourhoodPrecisionLabel: 'Neighbourhood only',
    postalCodeLabel: 'Postal code',
    provinceLabel: 'Province',
    publicContactEmailLabel: 'Publish this email on the public profile',
    publicPrecisionHelp: 'Neighbourhood precision is the privacy-preserving default. Exact address should be used only for a public venue.',
    privacy: {
      description: 'Ask Kamga to remove private contact details or delist this record from the public directory. Admin review is required before any terminal privacy action is applied.',
      reasonLabel: 'Reason or context',
      reasonPlaceholder: 'Add the operational context the admin should consider.',
      requestAction: 'Submit privacy request',
      requestPending: 'Submitting...',
      requestSubmitted: 'Privacy request submitted for admin review.',
      title: 'Privacy and removal request',
      typeLabel: 'Request type',
      requestTypes: {
        delist_record: 'Delist this association record',
        remove_contact: 'Remove private contact details'
      },
      errors: {
        'KMG-AUTH-401': 'Sign in again before submitting this request.',
        'KMG-AUTH-403': 'Only an active association admin can submit this request.',
        'KMG-PC-001': 'Check the privacy request fields and try again.',
        'KMG-PC-404': 'This privacy request could not be found.',
        'KMG-PC-409': 'A pending request of this type already exists.',
        'KMG-SYS-000': 'The privacy request could not be submitted. Try again or contact support.'
      }
    },
    publicPrecisionLabel: 'Public location precision',
    saved: 'Association record saved.',
    saveAction: 'Save record',
    saving: 'Saving...',
    statusLabel: 'Platform status',
    streetLabel: 'Street address',
    title: 'Associations',
    verificationLabel: 'Verification status',
    errors: {
      'KMG-AUTH-401': 'Sign in again before editing this association.',
      'KMG-AUTH-403': 'You can edit only associations where you are an active association admin.',
      'KMG-RG-001': 'Check the submitted fields and try again.',
      'KMG-SYS-000': 'The association record could not be saved. Try again or contact support.'
    },
    optInStatuses: {
      confirmed: 'Notification opt-in confirmed for this email.',
      pending: 'Notification opt-in pending. Only confirmation emails can be sent to this address.',
      withdrawn: 'Notification opt-in withdrawn. No system notifications are sent to this address.'
    },
    statuses: {
      active: 'Active',
      declined: 'Declined',
      pending_review: 'Pending review',
      suspended: 'Suspended'
    },
    verificationStatuses: {
      needs_review: 'Needs review',
      unverified: 'Unverified',
      verified: 'Verified'
    }
  },
  fr: {
    cityLabel: 'Ville',
    commonNameHelp: 'Affiche si le nom public diffÃ¨re du nom officiel.',
    commonNameLabel: 'Nom courant',
    contactEmailHelp: 'Modifier ce courriel envoie une nouvelle demande de confirmation. Il nâ€™est jamais utilisÃ© pour les notifications avant confirmation.',
    contactEmailLabel: 'Courriel de contact privÃ©',
    description: 'Modifiez la fiche revendiquÃ©e de votre association. La vÃ©rification, la source et le statut plateforme restent contrÃ´lÃ©s par les administrateurs Kamga.',
    descriptionLabel: 'Description publique',
    emptyAction: 'Inscrire une association',
    emptyState: 'Aucune association revendiquÃ©e nâ€™est encore rattachÃ©e Ã  ce compte.',
    exactPrecisionLabel: 'Adresse exacte',
    languageLabel: 'Langue principale',
    nameLabel: 'Nom officiel',
    neighbourhoodPrecisionLabel: 'Quartier uniquement',
    postalCodeLabel: 'Code postal',
    provinceLabel: 'Province',
    publicContactEmailLabel: 'Publier ce courriel sur la fiche publique',
    publicPrecisionHelp: 'La prÃ©cision quartier est le choix par dÃ©faut pour protÃ©ger la vie privÃ©e. Lâ€™adresse exacte doit Ãªtre rÃ©servÃ©e aux lieux publics.',
    publicPrecisionLabel: 'PrÃ©cision publique de localisation',
    privacy: {
      description: 'Demandez a Kamga de retirer les coordonnees privees ou de retirer cette fiche de l annuaire public. Une revue admin est requise avant toute action privacy terminale.',
      reasonLabel: 'Motif ou contexte',
      reasonPlaceholder: 'Ajoutez le contexte operationnel que l admin doit prendre en compte.',
      requestAction: 'Envoyer la demande privacy',
      requestPending: 'Envoi...',
      requestSubmitted: 'Demande privacy envoyee pour revue admin.',
      title: 'Confidentialite et retrait',
      typeLabel: 'Type de demande',
      requestTypes: {
        delist_record: 'Retirer cette fiche association',
        remove_contact: 'Retirer les coordonnees privees'
      },
      errors: {
        'KMG-AUTH-401': 'Reconnectez-vous avant d envoyer cette demande.',
        'KMG-AUTH-403': 'Seul un admin association actif peut envoyer cette demande.',
        'KMG-PC-001': 'Verifiez les champs de la demande privacy puis reessayez.',
        'KMG-PC-404': 'Cette demande privacy est introuvable.',
        'KMG-PC-409': 'Une demande de ce type est deja en attente.',
        'KMG-SYS-000': 'La demande privacy n a pas pu etre envoyee. Reessayez ou contactez le support.'
      }
    },
    saved: 'Fiche association enregistrÃ©e.',
    saveAction: 'Enregistrer la fiche',
    saving: 'Enregistrement...',
    statusLabel: 'Statut plateforme',
    streetLabel: 'Adresse civique',
    title: 'Associations',
    verificationLabel: 'Statut de vÃ©rification',
    errors: {
      'KMG-AUTH-401': 'Reconnectez-vous avant de modifier cette association.',
      'KMG-AUTH-403': 'Vous pouvez modifier uniquement les associations oÃ¹ vous Ãªtes admin association actif.',
      'KMG-RG-001': 'VÃ©rifiez les champs envoyÃ©s puis rÃ©essayez.',
      'KMG-SYS-000': 'La fiche association nâ€™a pas pu Ãªtre enregistrÃ©e. RÃ©essayez ou contactez le support.'
    },
    optInStatuses: {
      confirmed: 'Opt-in de notification confirmÃ© pour ce courriel.',
      pending: 'Opt-in de notification en attente. Seuls les courriels de confirmation peuvent Ãªtre envoyÃ©s Ã  cette adresse.',
      withdrawn: 'Opt-in de notification retirÃ©. Aucune notification systÃ¨me nâ€™est envoyÃ©e Ã  cette adresse.'
    },
    statuses: {
      active: 'Active',
      declined: 'RefusÃ©e',
      pending_review: 'En revue',
      suspended: 'Suspendue'
    },
    verificationStatuses: {
      needs_review: 'Ã€ revoir',
      unverified: 'Non vÃ©rifiÃ©e',
      verified: 'VÃ©rifiÃ©e'
    }
  }
} as const;

async function listManagedAssociations(): Promise<AssociationRecord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_members')
    .select(
      'id,associations:association_id(id,name,official_name,common_name,description,city,province,postal_code,street_address,primary_language,public_precision,contact_email,public_contact_email,contact_notification_opt_in_status,verification_status,claim_status,status)'
    )
    .eq('role', 'association_admin')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = membershipAssociationSchema.safeParse(row);
    if (!parsed.success) {
      return [];
    }

    const association = Array.isArray(parsed.data.associations) ? parsed.data.associations[0] : parsed.data.associations;
    return association === null || association === undefined ? [] : [association];
  });
}

export default async function DashboardAssociationsPage({ params }: DashboardAssociationsPageProps) {
  const currentUser = await requireUser();
  const associations = await listManagedAssociations();
  const c = copy[params.locale];

  return (
    <MemberWorkspaceShell activeItem="associations" locale={params.locale} title={c.title} userEmail={currentUser.user.email}>
      <section className="grid gap-8">
        <div>
          <p className="max-w-3xl text-base leading-7 text-secondary">{c.description}</p>
        </div>

        {associations.length === 0 ? (
          <article className="rounded-md border border-border bg-card p-8 shadow-card">
            <p className="text-base text-secondary">{c.emptyState}</p>
            <Link className="mt-6 inline-flex w-fit items-center rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-on-brand shadow-card" href="/register">
              {c.emptyAction}
            </Link>
          </article>
        ) : (
          associations.map((association) => (
            <article className="grid gap-5" key={association.id}>
              <div className="rounded-md border border-border bg-sunken p-5">
                <dl className="grid gap-4 md:grid-cols-2">
                  <div>
                    <dt className="text-sm font-semibold text-secondary">{c.statusLabel}</dt>
                    <dd className="mt-1 text-heading">{c.statuses[association.status]}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-secondary">{c.verificationLabel}</dt>
                    <dd className="mt-1 text-heading">{c.verificationStatuses[association.verification_status]}</dd>
                  </div>
                </dl>
              </div>
              <AssociationRecordManagementForm association={association} copy={c} locale={params.locale} />
              <AssociationPrivacyRequestForm associationId={association.id} copy={c.privacy} locale={params.locale} />
            </article>
          ))
        )}
      </section>
    </MemberWorkspaceShell>
  );
}
