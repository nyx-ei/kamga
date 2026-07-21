import { getFormatter } from 'next-intl/server';
import { CheckCircle2, Lock, Search, UserCheck, XCircle } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { resolveAssociationClaimRequest } from '@/features/associations/actions';
import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const claimRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'locked']);
const claimRequestDecisionSchema = z.enum(['approved', 'rejected', 'locked']);

const claimRequestRowSchema = z.object({
  association_id: z.string().uuid(),
  associations: z.object({
    city: z.string(),
    claim_status: z.string(),
    contact_email: z.string().nullable(),
    name: z.string(),
    registry_number: z.string().nullable(),
    verification_status: z.string()
  }).nullable(),
  claimant_user_id: z.string().uuid(),
  contact_email_attempted: z.string(),
  created_at: z.string(),
  failure_reason: z.enum(['missing_private_data', 'mismatch', 'competing_claim']).nullable(),
  id: z.string().uuid(),
  registry_number_attempted: z.string(),
  reviewed_at: z.string().nullable(),
  status: claimRequestStatusSchema,
  users: z.object({
    email: z.string().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable()
  }).nullable()
});

type AdminClaimRequestsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    status?: string;
  };
};

type ClaimRequestRow = z.infer<typeof claimRequestRowSchema>;
type ClaimRequestStatus = z.infer<typeof claimRequestStatusSchema>;
type ClaimRequestDecision = z.infer<typeof claimRequestDecisionSchema>;

const copy = {
  en: {
    actionApprove: 'Approve claim',
    actionLock: 'Lock record',
    actionReject: 'Reject claim',
    associationLabel: 'Association',
    attemptedContactLabel: 'Submitted contact email',
    attemptedRegistryLabel: 'Submitted registry number',
    badge: 'Claim verification',
    createdAtLabel: 'Submitted',
    description:
      'Resolve listing ownership claims that could not be automatically confirmed. Approval grants association-admin ownership; rejection returns the listing to unclaimed if no active claim remains.',
    emptyState: 'No claim request matches this filter.',
    failureReasonLabel: 'Reason',
    failureReasons: {
      competing_claim: 'Competing claim',
      mismatch: 'Registry/contact mismatch',
      missing_private_data: 'Missing private record data'
    },
    filters: {
      all: 'All',
      approved: 'Approved',
      locked: 'Locked',
      pending: 'Pending',
      rejected: 'Rejected'
    },
    internalRecordLabel: 'Private record values',
    notAvailable: 'Not available',
    requesterLabel: 'Claimant',
    reviewedAtLabel: 'Reviewed',
    statuses: {
      approved: 'Approved',
      locked: 'Locked',
      pending: 'Pending',
      rejected: 'Rejected'
    },
    title: 'Claim requests'
  },
  fr: {
    actionApprove: 'Approuver la revendication',
    actionLock: 'Verrouiller la fiche',
    actionReject: 'Refuser la revendication',
    associationLabel: 'Association',
    attemptedContactLabel: 'Courriel soumis',
    attemptedRegistryLabel: 'Numéro de registre soumis',
    badge: 'Vérification des revendications',
    createdAtLabel: 'Soumise le',
    description:
      'Résolvez les revendications de fiches qui n’ont pas pu être confirmées automatiquement. L’approbation accorde le rôle admin association ; le refus remet la fiche en non revendiquée si aucune demande active ne reste ouverte.',
    emptyState: 'Aucune revendication ne correspond à ce filtre.',
    failureReasonLabel: 'Motif',
    failureReasons: {
      competing_claim: 'Revendication concurrente',
      mismatch: 'Registre/contact non correspondant',
      missing_private_data: 'Données privées manquantes'
    },
    filters: {
      all: 'Toutes',
      approved: 'Approuvées',
      locked: 'Verrouillées',
      pending: 'En attente',
      rejected: 'Refusées'
    },
    internalRecordLabel: 'Valeurs privées de la fiche',
    notAvailable: 'Non disponible',
    requesterLabel: 'Demandeur',
    reviewedAtLabel: 'Revue le',
    statuses: {
      approved: 'Approuvée',
      locked: 'Verrouillée',
      pending: 'En attente',
      rejected: 'Refusée'
    },
    title: 'Revendications'
  }
} as const;

function statusFilter(value: string | undefined): ClaimRequestStatus | 'all' {
  const parsed = claimRequestStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'pending';
}

async function listClaimRequests(status: ClaimRequestStatus | 'all'): Promise<ClaimRequestRow[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('association_claim_requests')
    .select('id,association_id,claimant_user_id,registry_number_attempted,contact_email_attempted,status,failure_reason,created_at,reviewed_at,associations:association_id(name,city,claim_status,verification_status,registry_number,contact_email),users:claimant_user_id(email,first_name,last_name)')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.limit(100);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = claimRequestRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function claimantName(row: ClaimRequestRow, fallback: string): string {
  const names = [row.users?.first_name, row.users?.last_name].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return names.length > 0 ? names.join(' ') : row.users?.email ?? fallback;
}

function ClaimDecisionForm({ decision, label, locale, requestId }: { decision: ClaimRequestDecision; label: string; locale: 'en' | 'fr'; requestId: string }) {
  const icon = decision === 'approved' ? <CheckCircle2 aria-hidden="true" size={16} /> : decision === 'locked' ? <Lock aria-hidden="true" size={16} /> : <XCircle aria-hidden="true" size={16} />;
  const className =
    decision === 'approved'
      ? 'inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong'
      : 'inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-body shadow-card transition hover:border-border-strong';

  return (
    <form action={resolveAssociationClaimRequest}>
      <input name="claimRequestId" type="hidden" value={requestId} />
      <input name="decision" type="hidden" value={decision} />
      <input name="locale" type="hidden" value={locale} />
      <button className={className} type="submit">
        {icon}
        {label}
      </button>
    </form>
  );
}

export default async function AdminClaimRequestsPage({ params, searchParams }: AdminClaimRequestsPageProps) {
  const currentUser = await requirePlatformAdmin();
  const format = await getFormatter();
  const c = copy[params.locale];
  const currentStatus = statusFilter(searchParams.status);
  const filters: Array<ClaimRequestStatus | 'all'> = ['pending', 'approved', 'rejected', 'locked', 'all'];
  const requests = await listClaimRequests(currentStatus);

  return (
    <AdminWorkspaceShell activeItem="claimRequests" locale={params.locale} title={c.title} userEmail={currentUser.user.email}>
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
              href={{ pathname: '/admin/claim-requests', query: { status: filter } }}
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
                      <UserCheck aria-hidden="true" size={15} />
                      {c.statuses[request.status]}
                    </span>
                  </div>

                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="font-medium text-secondary">{c.requesterLabel}</dt>
                      <dd className="mt-1 break-words text-heading">{claimantName(request, c.notAvailable)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.attemptedRegistryLabel}</dt>
                      <dd className="mt-1 break-words font-mono text-heading">{request.registry_number_attempted}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.attemptedContactLabel}</dt>
                      <dd className="mt-1 break-words text-heading">{request.contact_email_attempted}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.createdAtLabel}</dt>
                      <dd className="mt-1 text-heading">{createdAt}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.internalRecordLabel}</dt>
                      <dd className="mt-1 break-words text-heading">
                        {[association?.registry_number, association?.contact_email].filter(Boolean).join(' · ') || c.notAvailable}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.reviewedAtLabel}</dt>
                      <dd className="mt-1 text-heading">{reviewedAt}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.failureReasonLabel}</dt>
                      <dd className="mt-1 text-heading">{request.failure_reason === null ? c.notAvailable : c.failureReasons[request.failure_reason]}</dd>
                    </div>
                  </dl>

                  {request.status === 'pending' ? (
                    <div className="flex flex-wrap gap-3">
                      <ClaimDecisionForm decision="approved" label={c.actionApprove} locale={params.locale} requestId={request.id} />
                      <ClaimDecisionForm decision="rejected" label={c.actionReject} locale={params.locale} requestId={request.id} />
                      <ClaimDecisionForm decision="locked" label={c.actionLock} locale={params.locale} requestId={request.id} />
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