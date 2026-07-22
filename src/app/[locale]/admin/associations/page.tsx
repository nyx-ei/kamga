import { getFormatter } from 'next-intl/server';
import { ExternalLink } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import {
  ASSOCIATION_CLAIM_STATUSES,
  ASSOCIATION_GEOCODE_STATUSES,
  ASSOCIATION_PRIMARY_LANGUAGES,
  ASSOCIATION_PUBLIC_PRECISIONS,
  ASSOCIATION_REGISTRY_TYPES,
  ASSOCIATION_SOURCES,
  ASSOCIATION_STATUSES,
  ASSOCIATION_VERIFICATION_STATUSES
} from '@/features/associations/association-types';
import { AdminAssociationMergeForm } from '@/features/associations/components/AdminAssociationMergeForm';
import { AdminAssociationRecordForm } from '@/features/associations/components/AdminAssociationRecordForm';
import { requirePlatformAdmin } from '@/lib/auth';
import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const adminAssociationSchema = z.object({
  city: z.string(),
  claim_status: z.enum(ASSOCIATION_CLAIM_STATUSES),
  common_name: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_notification_opt_in_status: z.enum(['confirmed', 'pending', 'withdrawn']),
  created_at: z.string(),
  description: z.string().nullable(),
  geocode_status: z.enum(ASSOCIATION_GEOCODE_STATUSES),
  id: z.string().uuid(),
  official_name: z.string(),
  postal_code: z.string().nullable(),
  primary_language: z.enum(ASSOCIATION_PRIMARY_LANGUAGES),
  province: z.string(),
  public_contact_email: z.boolean(),
  public_precision: z.enum(ASSOCIATION_PUBLIC_PRECISIONS),
  registry_number: z.string().nullable(),
  registry_type: z.enum(ASSOCIATION_REGISTRY_TYPES).nullable(),
  rpn_affiliation_proof_path: z.string().nullable(),
  source: z.enum(ASSOCIATION_SOURCES),
  status: z.enum(ASSOCIATION_STATUSES),
  street_address: z.string().nullable(),
  updated_at: z.string(),
  verification_status: z.enum(ASSOCIATION_VERIFICATION_STATUSES)
});

type AdminAssociationsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

type AdminAssociation = z.infer<typeof adminAssociationSchema> & {
  proofUrl: string | null;
};

const copy = {
  en: {
    badge: 'Layer 1 admin',
    title: 'Association records',
    description: 'Edit directory records, verification, geocoding and claim states. Public exposure remains governed by privacy consent.',
    emptyState: 'No association record exists yet.',
    proofLabel: 'RPN proof',
    openProofAction: 'Open proof',
    notProvided: 'Not provided',
    submittedAtLabel: 'Created',
    updatedAtLabel: 'Updated',
    pendingReview: 'Needs review',
    activeRecords: 'Active records',
    verifiedRecords: 'Verified records',
    merge: {
      description: 'Absorb a duplicate record into this canonical association while keeping member, claim, referral and financial history attached to the kept record.',
      duplicateLabel: 'Duplicate record to merge',
      mergeAction: 'Merge duplicate',
      merged: 'Duplicate record merged.',
      noDuplicateOptions: 'No other association record is available to merge.',
      pendingAction: 'Merging...',
      title: 'Duplicate merge',
      warning: 'This operation is transactional and should only be used after admin review.',
      errors: {
        'KMG-AUTH-401': 'Sign in before merging records.',
        'KMG-AUTH-403': 'Only platform admins can merge association records.',
        'KMG-MG-001': 'Select two different association records.',
        'KMG-MG-404': 'One of the selected association records could not be found.',
        'KMG-MG-409': 'The duplicate record has already been merged.',
        'KMG-SYS-000': 'The records could not be merged. Try again or contact support.'
      }
    },    form: {
      cityLabel: 'City',
      claimStatusLabel: 'Claim status',
      commonNameHelp: 'Displayed publicly when different from the official name.',
      commonNameLabel: 'Common name',
      contactEmailHelp: 'Changing this email restarts the double opt-in confirmation. Admins cannot confirm opt-in on behalf of an association.',
      contactEmailLabel: 'Private contact email',
      descriptionLabel: 'Public description',
      exactPrecisionLabel: 'Exact address',
      geocodeStatusLabel: 'Geocode status',
      languageLabel: 'Primary language',
      nameLabel: 'Official name',
      neighbourhoodPrecisionLabel: 'Neighbourhood only',
      optInLabel: 'Notification opt-in:',
      postalCodeLabel: 'Postal code',
      provinceLabel: 'Province',
      publicContactEmailLabel: 'Publish contact email publicly',
      publicPrecisionHelp: 'Exact public precision should be used only for an opted-in public venue or explicit admin override.',
      publicPrecisionLabel: 'Public precision',
      registryNumberLabel: 'Registry number',
      registryTypeLabel: 'Registry type',
      saved: 'Record saved.',
      saveAction: 'Save record',
      saving: 'Saving...',
      sourceLabel: 'Source',
      statusLabel: 'Platform status',
      streetLabel: 'Street address',
      verificationStatusLabel: 'Verification',
      errors: {
        'KMG-AUTH-401': 'Sign in before editing records.',
        'KMG-AUTH-403': 'Only platform admins can edit all association records.',
        'KMG-RG-001': 'Check the record fields and try again.',
        'KMG-RG-404': 'This association record could not be found.',
        'KMG-SYS-000': 'The association record could not be saved. Try again or contact support.'
      },
      claimStatuses: {
        claimed: 'Claimed',
        claim_locked: 'Claim locked',
        claim_pending: 'Claim pending',
        unclaimed: 'Unclaimed'
      },
      geocodeStatuses: {
        failed: 'Failed',
        geocoded: 'Geocoded',
        needs_review: 'Needs review',
        pending: 'Pending'
      },
      optInStatuses: {
        confirmed: 'Confirmed',
        pending: 'Pending confirmation',
        withdrawn: 'Withdrawn'
      },
      primaryLanguages: {
        en: 'English',
        fr: 'French',
        fr_en: 'French & English'
      },
      publicPrecisions: {
        exact: 'Exact address',
        neighbourhood: 'Neighbourhood only'
      },
      registryTypes: {
        federal: 'Federal',
        neq: 'NEQ'
      },
      sources: {
        admin_entered: 'Admin entered',
        csv_import: 'CSV import',
        self_registered: 'Self-registered'
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
    }
  },
  fr: {
    badge: 'Admin Couche 1',
    title: 'Fiches associations',
    description: 'Modifiez les fiches de l’annuaire, la vérification, le géocodage et les états de revendication. L’exposition publique reste encadrée par le consentement.',
    emptyState: 'Aucune fiche association n’existe encore.',
    proofLabel: 'Preuve RPN',
    openProofAction: 'Ouvrir la preuve',
    notProvided: 'Non fourni',
    submittedAtLabel: 'Créée le',
    updatedAtLabel: 'Mise à jour le',
    pendingReview: 'À revoir',
    activeRecords: 'Fiches actives',
    verifiedRecords: 'Fiches vérifiées',
    merge: {
      description: 'Absorbez une fiche doublon dans cette fiche canonique en conservant l historique membres, revendications, parrainages et finance sur la fiche gardee.',
      duplicateLabel: 'Fiche doublon a fusionner',
      mergeAction: 'Fusionner le doublon',
      merged: 'Fiche doublon fusionnee.',
      noDuplicateOptions: 'Aucune autre fiche association n est disponible pour une fusion.',
      pendingAction: 'Fusion en cours...',
      title: 'Fusion de doublon',
      warning: 'Cette operation est transactionnelle et doit etre utilisee seulement apres revue admin.',
      errors: {
        'KMG-AUTH-401': 'Connectez-vous avant de fusionner les fiches.',
        'KMG-AUTH-403': 'Seuls les admins plateforme peuvent fusionner les fiches association.',
        'KMG-MG-001': 'Selectionnez deux fiches association differentes.',
        'KMG-MG-404': 'Une des fiches association selectionnees est introuvable.',
        'KMG-MG-409': 'La fiche doublon a deja ete fusionnee.',
        'KMG-SYS-000': 'Les fiches n ont pas pu etre fusionnees. Reessayez ou contactez le support.'
      }
    },    form: {
      cityLabel: 'Ville',
      claimStatusLabel: 'État de revendication',
      commonNameHelp: 'Affiché publiquement lorsqu’il diffère du nom officiel.',
      commonNameLabel: 'Nom courant',
      contactEmailHelp: 'Modifier cet email relance la confirmation double opt-in. Un admin ne peut pas confirmer l’opt-in à la place de l’association.',
      contactEmailLabel: 'Email de contact privé',
      descriptionLabel: 'Description publique',
      exactPrecisionLabel: 'Adresse exacte',
      geocodeStatusLabel: 'État du géocodage',
      languageLabel: 'Langue principale',
      nameLabel: 'Nom officiel',
      neighbourhoodPrecisionLabel: 'Quartier seulement',
      optInLabel: 'Opt-in notifications :',
      postalCodeLabel: 'Code postal',
      provinceLabel: 'Province',
      publicContactEmailLabel: 'Publier l’email de contact',
      publicPrecisionHelp: 'La précision exacte doit être réservée à un lieu public avec consentement ou à une dérogation admin explicite.',
      publicPrecisionLabel: 'Précision publique',
      registryNumberLabel: 'Numéro de registre',
      registryTypeLabel: 'Type de registre',
      saved: 'Fiche enregistrée.',
      saveAction: 'Enregistrer la fiche',
      saving: 'Enregistrement...',
      sourceLabel: 'Source',
      statusLabel: 'Statut plateforme',
      streetLabel: 'Adresse civique',
      verificationStatusLabel: 'Vérification',
      errors: {
        'KMG-AUTH-401': 'Connectez-vous avant de modifier les fiches.',
        'KMG-AUTH-403': 'Seuls les admins plateforme peuvent modifier toutes les fiches association.',
        'KMG-RG-001': 'Vérifiez les champs de la fiche puis réessayez.',
        'KMG-RG-404': 'Cette fiche association est introuvable.',
        'KMG-SYS-000': 'La fiche association n’a pas pu être enregistrée. Réessayez ou contactez le support.'
      },
      claimStatuses: {
        claimed: 'Revendiquée',
        claim_locked: 'Revendication verrouillée',
        claim_pending: 'Revendication en attente',
        unclaimed: 'Non revendiquée'
      },
      geocodeStatuses: {
        failed: 'Échec',
        geocoded: 'Géocodée',
        needs_review: 'À revoir',
        pending: 'En attente'
      },
      optInStatuses: {
        confirmed: 'Confirmé',
        pending: 'Confirmation en attente',
        withdrawn: 'Retiré'
      },
      primaryLanguages: {
        en: 'Anglais',
        fr: 'Français',
        fr_en: 'Français et anglais'
      },
      publicPrecisions: {
        exact: 'Adresse exacte',
        neighbourhood: 'Quartier seulement'
      },
      registryTypes: {
        federal: 'Fédéral',
        neq: 'NEQ'
      },
      sources: {
        admin_entered: 'Saisie admin',
        csv_import: 'Import CSV',
        self_registered: 'Auto-inscription'
      },
      statuses: {
        active: 'Active',
        declined: 'Refusée',
        pending_review: 'En revue',
        suspended: 'Suspendue'
      },
      verificationStatuses: {
        needs_review: 'À revoir',
        unverified: 'Non vérifiée',
        verified: 'Vérifiée'
      }
    }
  }
} as const;

async function listAdminAssociations(): Promise<AdminAssociation[]> {
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase
    .from('associations')
    .select('id,official_name,common_name,description,city,province,postal_code,street_address,primary_language,public_precision,public_contact_email,contact_email,contact_notification_opt_in_status,registry_type,registry_number,verification_status,claim_status,geocode_status,source,status,created_at,updated_at,rpn_affiliation_proof_path')
    .order('updated_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  const rows = data.flatMap((row: unknown) => {
    const parsed = adminAssociationSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  return Promise.all(
    rows.map(async (row) => {
      if (row.rpn_affiliation_proof_path === null) {
        return { ...row, proofUrl: null };
      }

      // CV-DB-04 / CV-SEC-07: platform admin review needs a short-lived private storage URL.
      const { data: signedUrlData } = await adminSupabase.storage
        .from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET)
        .createSignedUrl(row.rpn_affiliation_proof_path, 300);

      return { ...row, proofUrl: signedUrlData?.signedUrl ?? null };
    })
  );
}

export default async function AdminAssociationsPage({ params }: AdminAssociationsPageProps) {
  const currentUser = await requirePlatformAdmin();
  const format = await getFormatter();
  const associations = await listAdminAssociations();
  const c = copy[params.locale];
  const pendingReviewCount = associations.filter((association) => association.status === 'pending_review' || association.verification_status === 'needs_review' || association.geocode_status === 'needs_review').length;
  const activeCount = associations.filter((association) => association.status === 'active').length;
  const verifiedCount = associations.filter((association) => association.verification_status === 'verified').length;
  const mergeOptions = associations.map((association) => ({
    city: association.city + ', ' + association.province,
    id: association.id,
    label: association.common_name ?? association.official_name,
    source: c.form.sources[association.source],
    status: c.form.statuses[association.status]
  }));

  return (
    <AdminWorkspaceShell activeItem="associations" locale={params.locale} title={c.title} userEmail={currentUser.user.email}>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{c.badge}</p>
            <p className="max-w-3xl text-base leading-7 text-secondary">{c.description}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-border bg-raised p-5 shadow-card">
            <p className="text-xs font-semibold uppercase text-muted">{c.pendingReview}</p>
            <p className="mt-2 text-3xl font-semibold text-heading">{pendingReviewCount}</p>
          </div>
          <div className="rounded-md border border-border bg-raised p-5 shadow-card">
            <p className="text-xs font-semibold uppercase text-muted">{c.activeRecords}</p>
            <p className="mt-2 text-3xl font-semibold text-heading">{activeCount}</p>
          </div>
          <div className="rounded-md border border-border bg-raised p-5 shadow-card">
            <p className="text-xs font-semibold uppercase text-muted">{c.verifiedRecords}</p>
            <p className="mt-2 text-3xl font-semibold text-heading">{verifiedCount}</p>
          </div>
        </div>

        {associations.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{c.emptyState}</div>
        ) : (
          <div className="grid gap-5">
            {associations.map((association) => (
              <article className="grid gap-4" key={association.id}>
                <div className="flex flex-col justify-between gap-3 rounded-md border border-border bg-card p-5 shadow-card lg:flex-row lg:items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-heading">{association.common_name ?? association.official_name}</h2>
                    <p className="mt-1 text-sm text-secondary">{association.city}, {association.province}</p>
                  </div>
                  <dl className="grid gap-3 text-sm md:grid-cols-3 lg:min-w-[520px]">
                    <div>
                      <dt className="font-medium text-secondary">{c.submittedAtLabel}</dt>
                      <dd className="mt-1 text-heading">{format.dateTime(new Date(association.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.updatedAtLabel}</dt>
                      <dd className="mt-1 text-heading">{format.dateTime(new Date(association.updated_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.proofLabel}</dt>
                      <dd className="mt-1">
                        {association.proofUrl === null ? (
                          <span className="text-muted">{c.notProvided}</span>
                        ) : (
                          <a className="inline-flex items-center gap-2 font-medium text-link transition hover:text-link-hover" href={association.proofUrl} rel="noreferrer" target="_blank">
                            <ExternalLink aria-hidden="true" size={14} />
                            {c.openProofAction}
                          </a>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <AdminAssociationRecordForm association={association} copy={c.form} locale={params.locale} />
                <AdminAssociationMergeForm
                  association={{
                    city: association.city + ', ' + association.province,
                    id: association.id,
                    label: association.common_name ?? association.official_name,
                    source: c.form.sources[association.source],
                    status: c.form.statuses[association.status]
                  }}
                  copy={c.merge}
                  locale={params.locale}
                  options={mergeOptions}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}
