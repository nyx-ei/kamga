import { getFormatter } from 'next-intl/server';
import { CheckCircle2, Mail, Search, XCircle } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { closeConnectRequest, markConnectRequestBrokered } from '@/features/associations/actions';
import { ASSOCIATION_CONNECT_REQUEST_STATUSES, type AssociationConnectRequestStatus } from '@/features/associations/association-types';
import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const connectRequestStatusSchema = z.enum(ASSOCIATION_CONNECT_REQUEST_STATUSES);

const connectRequestRowSchema = z.object({
  id: z.string().uuid(),
  association_id: z.string().uuid(),
  brokered_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  locale: z.enum(['en', 'fr']),
  message: z.string(),
  requester_email: z.string().nullable(),
  requester_name: z.string(),
  requester_phone: z.string().nullable(),
  routed_to_claimed_record: z.boolean(),
  status: connectRequestStatusSchema,
  associations: z
    .object({
      city: z.string(),
      claim_status: z.string(),
      contact_email: z.string().nullable(),
      contact_notification_opt_in_status: z.string(),
      connect_request_count: z.number(),
      name: z.string()
    })
    .nullable()
});

type AdminConnectRequestsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    status?: string;
  };
};

type ConnectRequestRow = z.infer<typeof connectRequestRowSchema>;

const copy = {
  en: {
    actionClose: 'Close request',
    actionMarkBrokered: 'Mark brokered',
    associationLabel: 'Association',
    badge: 'Layer 1 routing',
    brokeredAtLabel: 'Brokered',
    claimStatusLabel: 'Claim status',
    closedAtLabel: 'Closed',
    contactOptInLabel: 'Contact opt-in',
    createdAtLabel: 'Submitted',
    description:
      'Review mediated first-contact requests, route queued requests for unclaimed records, and close requests once the association has been brokered or no further action is needed.',
    emptyState: 'No connect request matches this filter.',
    filters: {
      all: 'All',
      brokered: 'Brokered',
      closed: 'Closed',
      queued: 'Queued',
      routed: 'Routed'
    },
    messageLabel: 'Message',
    notAvailable: 'Not available',
    privateContactLabel: 'Private contact',
    requesterLabel: 'Requester',
    replyChannelLabel: 'Reply channel',
    routedHint: 'Claimed record. The request is ready to be routed to the association contact if consent permits outreach.',
    queuedHint: 'Unclaimed record. Keep this request queued until an admin brokers contact or the association claims the listing.',
    statuses: {
      brokered: 'Brokered',
      closed: 'Closed',
      queued: 'Queued',
      routed: 'Routed'
    },
    title: 'Connect requests',
    totalDemandLabel: 'Total demand'
  },
  fr: {
    actionClose: 'Clôturer la demande',
    actionMarkBrokered: 'Marquer comme mise en relation',
    associationLabel: 'Association',
    badge: 'Routage Couche 1',
    brokeredAtLabel: 'Mise en relation',
    claimStatusLabel: 'État de revendication',
    closedAtLabel: 'Clôturée',
    contactOptInLabel: 'Opt-in contact',
    createdAtLabel: 'Soumise',
    description:
      'Revoyez les demandes de premier contact médié, routez les demandes en file pour les fiches non revendiquées, puis clôturez celles qui ne demandent plus d’action.',
    emptyState: 'Aucune demande de mise en relation ne correspond à ce filtre.',
    filters: {
      all: 'Toutes',
      brokered: 'Mises en relation',
      closed: 'Clôturées',
      queued: 'En file',
      routed: 'Routées'
    },
    messageLabel: 'Message',
    notAvailable: 'Non disponible',
    privateContactLabel: 'Contact privé',
    requesterLabel: 'Demandeur',
    replyChannelLabel: 'Canal de réponse',
    routedHint: 'Fiche revendiquée. La demande peut être routée vers le contact de l’association si le consentement permet l’envoi.',
    queuedHint: 'Fiche non revendiquée. Gardez cette demande en file jusqu’à ce qu’un admin fasse la mise en relation ou que l’association revendique la fiche.',
    statuses: {
      brokered: 'Mise en relation',
      closed: 'Clôturée',
      queued: 'En file',
      routed: 'Routée'
    },
    title: 'Demandes contact',
    totalDemandLabel: 'Demande cumulée'
  }
} as const;

function statusFilter(value: string | undefined): AssociationConnectRequestStatus | 'all' {
  const parsed = connectRequestStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'queued';
}

async function listConnectRequests(status: AssociationConnectRequestStatus | 'all'): Promise<ConnectRequestRow[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('association_connect_requests')
    .select(
      'id,association_id,requester_name,requester_email,requester_phone,message,locale,status,routed_to_claimed_record,created_at,brokered_at,closed_at,associations:association_id(name,city,claim_status,contact_email,contact_notification_opt_in_status,connect_request_count)'
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
    const parsed = connectRequestRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function replyChannel(request: ConnectRequestRow): string {
  return [request.requester_email, request.requester_phone].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' · ');
}

function ConnectRequestActionForm({ action, label, locale, requestId, variant }: { action: (formData: FormData) => Promise<void>; label: string; locale: 'en' | 'fr'; requestId: string; variant: 'primary' | 'secondary' }) {
  return (
    <form action={action}>
      <input name="connectRequestId" type="hidden" value={requestId} />
      <input name="locale" type="hidden" value={locale} />
      <button
        className={
          variant === 'primary'
            ? 'inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong'
            : 'inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-body shadow-card transition hover:border-border-strong'
        }
        type="submit"
      >
        {variant === 'primary' ? <CheckCircle2 aria-hidden="true" size={16} /> : <XCircle aria-hidden="true" size={16} />}
        {label}
      </button>
    </form>
  );
}

export default async function AdminConnectRequestsPage({ params, searchParams }: AdminConnectRequestsPageProps) {
  const currentUser = await requirePlatformAdmin();
  const format = await getFormatter();
  const c = copy[params.locale];
  const currentStatus = statusFilter(searchParams.status);
  const filters: Array<AssociationConnectRequestStatus | 'all'> = ['queued', 'routed', 'brokered', 'closed', 'all'];
  const requests = await listConnectRequests(currentStatus);

  return (
    <AdminWorkspaceShell activeItem="connectRequests" locale={params.locale} title={c.title} userEmail={currentUser.user.email}>
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
              href={{ pathname: '/admin/connect-requests', query: { status: filter } }}
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
              const brokeredAt = request.brokered_at === null ? c.notAvailable : format.dateTime(new Date(request.brokered_at), { dateStyle: 'medium', timeStyle: 'short' });
              const closedAt = request.closed_at === null ? c.notAvailable : format.dateTime(new Date(request.closed_at), { dateStyle: 'medium', timeStyle: 'short' });

              return (
                <article className="grid gap-5 rounded-md border border-border bg-raised p-5 shadow-card" key={request.id}>
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted">{c.associationLabel}</p>
                      <h2 className="text-xl font-semibold text-heading">{association?.name ?? c.notAvailable}</h2>
                      <p className="text-sm text-secondary">{association?.city ?? c.notAvailable}</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sunken px-3 py-1 text-sm font-semibold text-heading">
                      <Mail aria-hidden="true" size={15} />
                      {c.statuses[request.status]}
                    </span>
                  </div>

                  <p className="rounded-sm border border-border bg-sunken px-4 py-3 text-sm leading-6 text-secondary">
                    {request.routed_to_claimed_record ? c.routedHint : c.queuedHint}
                  </p>

                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="font-medium text-secondary">{c.requesterLabel}</dt>
                      <dd className="mt-1 text-heading">{request.requester_name}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.replyChannelLabel}</dt>
                      <dd className="mt-1 break-words text-heading">{replyChannel(request) || c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.privateContactLabel}</dt>
                      <dd className="mt-1 break-words text-heading">{association?.contact_email ?? c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.totalDemandLabel}</dt>
                      <dd className="mt-1 text-heading">{association?.connect_request_count ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.claimStatusLabel}</dt>
                      <dd className="mt-1 text-heading">{association?.claim_status ?? c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.contactOptInLabel}</dt>
                      <dd className="mt-1 text-heading">{association?.contact_notification_opt_in_status ?? c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.createdAtLabel}</dt>
                      <dd className="mt-1 text-heading">{createdAt}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{request.status === 'closed' ? c.closedAtLabel : c.brokeredAtLabel}</dt>
                      <dd className="mt-1 text-heading">{request.status === 'closed' ? closedAt : brokeredAt}</dd>
                    </div>
                  </dl>

                  <div className="rounded-sm border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-heading">{c.messageLabel}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{request.message}</p>
                  </div>

                  {request.status === 'closed' ? null : (
                    <div className="flex flex-wrap gap-3">
                      {request.status !== 'brokered' ? (
                        <ConnectRequestActionForm action={markConnectRequestBrokered} label={c.actionMarkBrokered} locale={params.locale} requestId={request.id} variant="primary" />
                      ) : null}
                      <ConnectRequestActionForm action={closeConnectRequest} label={c.actionClose} locale={params.locale} requestId={request.id} variant="secondary" />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminWorkspaceShell>
  );
}
