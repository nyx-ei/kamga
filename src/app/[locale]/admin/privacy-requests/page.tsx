import { getFormatter } from 'next-intl/server';
import { CheckCircle2, Search, ShieldCheck, XCircle } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { ASSOCIATION_PRIVACY_REQUEST_DECISIONS, ASSOCIATION_PRIVACY_REQUEST_TYPES } from '@/features/associations/association-types';
import { AdminPrivacyRequestDecisionForm } from '@/features/associations/components/AdminPrivacyRequestDecisionForm';
import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const privacyRequestStatusSchema = z.enum(['pending', 'completed', 'rejected']);
const privacyRequestTypeSchema = z.enum(ASSOCIATION_PRIVACY_REQUEST_TYPES);
const privacyRequestDecisionSchema = z.enum(ASSOCIATION_PRIVACY_REQUEST_DECISIONS);

const privacyRequestRowSchema = z.object({
  admin_note: z.string().nullable(),
  association_id: z.string().uuid(),
  associations: z
    .object({
      city: z.string().nullable(),
      contact_email: z.string().nullable(),
      contact_notification_opt_in_status: z.string().nullable(),
      name: z.string().nullable(),
      public_contact_email: z.boolean().nullable(),
      status: z.string().nullable()
    })
    .nullable(),
  created_at: z.string(),
  id: z.string().uuid(),
  reason: z.string().nullable(),
  request_type: privacyRequestTypeSchema,
  requester_user_id: z.string().uuid(),
  reviewed_at: z.string().nullable(),
  status: privacyRequestStatusSchema,
  users: z
    .object({
      email: z.string().nullable(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable()
    })
    .nullable()
});

type AdminPrivacyRequestsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    status?: string;
  };
};

type PrivacyRequestRow = z.infer<typeof privacyRequestRowSchema>;
type PrivacyRequestStatus = z.infer<typeof privacyRequestStatusSchema>;
type PrivacyRequestDecision = z.infer<typeof privacyRequestDecisionSchema>;

const copy = {
  en: {
    actionComplete: 'Complete request',
    actionReject: 'Reject request',
    adminNoteLabel: 'Admin note',
    adminNotePlaceholder: 'Add internal context for the audit trail.',
    associationLabel: 'Association',
    badge: 'Privacy and consent',
    contactLabel: 'Current private contact',
    createdAtLabel: 'Submitted',
    description:
      'Process association requests to remove contact details or delist records. Completion applies the privacy-safe database update and keeps an auditable decision trail.',
    emptyState: 'No privacy request matches this filter.',
    errors: {
      'KMG-AUTH-401': 'Sign in before resolving this request.',
      'KMG-AUTH-403': 'Only platform admins can resolve privacy requests.',
      'KMG-PC-001': 'Check the decision fields and try again.',
      'KMG-PC-404': 'This privacy request could not be found.',
      'KMG-PC-409': 'This privacy request is no longer pending.',
      'KMG-SYS-000': 'The privacy request could not be resolved. Try again.'
    },
    filters: {
      all: 'All',
      completed: 'Completed',
      pending: 'Pending',
      rejected: 'Rejected'
    },
    notAvailable: 'Not available',
    optInLabel: 'Contact opt-in',
    pendingAction: 'Saving...',
    publicContactLabel: 'Public contact',
    reasonLabel: 'Reason',
    requestedByLabel: 'Requested by',
    reviewedAtLabel: 'Reviewed',
    statusLabel: 'Record status',
    statuses: {
      completed: 'Completed',
      pending: 'Pending',
      rejected: 'Rejected'
    },
    submitted: 'Decision saved.',
    title: 'Privacy requests',
    typeLabel: 'Request type',
    types: {
      delist_record: 'Delist record',
      remove_contact: 'Remove contact details'
    },
    yesNo: {
      no: 'No',
      yes: 'Yes'
    }
  },
  fr: {
    actionComplete: 'Finaliser la demande',
    actionReject: 'Rejeter la demande',
    adminNoteLabel: 'Note admin',
    adminNotePlaceholder: 'Ajoutez le contexte interne pour la piste audit.',
    associationLabel: 'Association',
    badge: 'Confidentialite et consentement',
    contactLabel: 'Contact prive actuel',
    createdAtLabel: 'Soumise le',
    description:
      'Traitez les demandes des associations pour retirer les coordonnees de contact ou retirer une fiche de l annuaire. La finalisation applique la mise a jour privacy-safe en base et conserve une decision auditable.',
    emptyState: 'Aucune demande privacy ne correspond a ce filtre.',
    errors: {
      'KMG-AUTH-401': 'Connectez-vous avant de traiter cette demande.',
      'KMG-AUTH-403': 'Seuls les admins plateforme peuvent traiter les demandes privacy.',
      'KMG-PC-001': 'Verifiez les champs de decision puis reessayez.',
      'KMG-PC-404': 'Cette demande privacy est introuvable.',
      'KMG-PC-409': 'Cette demande privacy n est plus en attente.',
      'KMG-SYS-000': 'La demande privacy n a pas pu etre traitee. Reessayez.'
    },
    filters: {
      all: 'Toutes',
      completed: 'Finalisees',
      pending: 'En attente',
      rejected: 'Rejetees'
    },
    notAvailable: 'Non disponible',
    optInLabel: 'Consentement contact',
    pendingAction: 'Enregistrement...',
    publicContactLabel: 'Contact public',
    reasonLabel: 'Motif',
    requestedByLabel: 'Demandee par',
    reviewedAtLabel: 'Revue le',
    statusLabel: 'Statut de fiche',
    statuses: {
      completed: 'Finalisee',
      pending: 'En attente',
      rejected: 'Rejetee'
    },
    submitted: 'Decision enregistree.',
    title: 'Demandes privacy',
    typeLabel: 'Type de demande',
    types: {
      delist_record: 'Retirer la fiche',
      remove_contact: 'Retirer les coordonnees'
    },
    yesNo: {
      no: 'Non',
      yes: 'Oui'
    }
  }
} as const;

function statusFilter(value: string | undefined): PrivacyRequestStatus | 'all' {
  const parsed = privacyRequestStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'pending';
}

async function listPrivacyRequests(status: PrivacyRequestStatus | 'all'): Promise<PrivacyRequestRow[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('association_privacy_requests')
    .select(
      'id,association_id,requester_user_id,request_type,reason,status,admin_note,created_at,reviewed_at,associations:association_id(name,city,status,contact_email,public_contact_email,contact_notification_opt_in_status),users:requester_user_id(email,first_name,last_name)'
    )
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.limit(100);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = privacyRequestRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function requesterName(row: PrivacyRequestRow, fallback: string): string {
  const names = [row.users?.first_name, row.users?.last_name].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return names.length > 0 ? names.join(' ') : row.users?.email ?? fallback;
}

function statusIcon(status: PrivacyRequestStatus) {
  if (status === 'completed') {
    return <CheckCircle2 aria-hidden="true" size={15} />;
  }

  if (status === 'rejected') {
    return <XCircle aria-hidden="true" size={15} />;
  }

  return <ShieldCheck aria-hidden="true" size={15} />;
}

export default async function AdminPrivacyRequestsPage({ params, searchParams }: AdminPrivacyRequestsPageProps) {
  const currentUser = await requirePlatformAdmin();
  const format = await getFormatter();
  const c = copy[params.locale];
  const currentStatus = statusFilter(searchParams.status);
  const filters: Array<PrivacyRequestStatus | 'all'> = ['pending', 'completed', 'rejected', 'all'];
  const requests = await listPrivacyRequests(currentStatus);

  return (
    <AdminWorkspaceShell activeItem="privacyRequests" locale={params.locale} title={c.title} userEmail={currentUser.user.email}>
      <section className="flex max-w-6xl flex-col gap-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase text-muted">{c.badge}</p>
          <p className="max-w-3xl text-base leading-7 text-secondary">{c.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              className={
                filter === currentStatus
                  ? 'inline-flex items-center gap-2 rounded-sm bg-brand px-3 py-2 text-sm font-medium text-on-brand shadow-card'
                  : 'inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong'
              }
              href={{ pathname: '/admin/privacy-requests', query: { status: filter } }}
              key={filter}
            >
              <Search aria-hidden="true" size={14} />
              {c.filters[filter]}
            </Link>
          ))}
        </div>

        {requests.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{c.emptyState}</div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => {
              const association = request.associations;
              const createdAt = format.dateTime(new Date(request.created_at), { dateStyle: 'medium', timeStyle: 'short' });
              const reviewedAt = request.reviewed_at === null ? c.notAvailable : format.dateTime(new Date(request.reviewed_at), { dateStyle: 'medium', timeStyle: 'short' });

              return (
                <article className="grid gap-5 rounded-md border border-border bg-raised p-5 shadow-card" key={request.id}>
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted">{c.associationLabel}</p>
                      <h2 className="text-xl font-semibold text-heading">{association?.name ?? c.notAvailable}</h2>
                      <p className="text-sm text-secondary">{association?.city ?? c.notAvailable}</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sunken px-3 py-1 text-sm font-semibold text-heading">
                      {statusIcon(request.status)}
                      {c.statuses[request.status]}
                    </span>
                  </div>

                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="font-medium text-secondary">{c.typeLabel}</dt>
                      <dd className="mt-1 text-heading">{c.types[request.request_type]}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.requestedByLabel}</dt>
                      <dd className="mt-1 break-words text-heading">{requesterName(request, c.notAvailable)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.createdAtLabel}</dt>
                      <dd className="mt-1 text-heading">{createdAt}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.reviewedAtLabel}</dt>
                      <dd className="mt-1 text-heading">{reviewedAt}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.contactLabel}</dt>
                      <dd className="mt-1 break-words text-heading">{association?.contact_email ?? c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.optInLabel}</dt>
                      <dd className="mt-1 text-heading">{association?.contact_notification_opt_in_status ?? c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.statusLabel}</dt>
                      <dd className="mt-1 text-heading">{association?.status ?? c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.publicContactLabel}</dt>
                      <dd className="mt-1 text-heading">{association?.public_contact_email === true ? c.yesNo.yes : c.yesNo.no}</dd>
                    </div>
                  </dl>

                  <div className="grid gap-3 rounded-sm border border-border bg-card p-4 text-sm text-secondary">
                    <p className="font-medium text-heading">{c.reasonLabel}</p>
                    <p className="leading-6">{request.reason ?? c.notAvailable}</p>
                    {request.admin_note !== null ? (
                      <>
                        <p className="pt-2 font-medium text-heading">{c.adminNoteLabel}</p>
                        <p className="leading-6">{request.admin_note}</p>
                      </>
                    ) : null}
                  </div>

                  {request.status === 'pending' ? (
                    <div className="grid gap-3 rounded-sm border border-border bg-sunken p-4 md:grid-cols-2">
                      {(['completed', 'rejected'] as PrivacyRequestDecision[]).map((decision) => (
                        <AdminPrivacyRequestDecisionForm
                          copy={{
                            errors: c.errors,
                            noteLabel: c.adminNoteLabel,
                            notePlaceholder: c.adminNotePlaceholder,
                            pending: c.pendingAction,
                            resolved: c.submitted,
                            submit: {
                              completed: c.actionComplete,
                              rejected: c.actionReject
                            }
                          }}
                          decision={decision}
                          key={decision}
                          locale={params.locale}
                          requestId={request.id}
                        />
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}
