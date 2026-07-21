import { getFormatter } from 'next-intl/server';
import { CheckCircle2, Megaphone, Search, XCircle } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { closeRecruitLead, markRecruitLeadContacted } from '@/features/associations/actions';
import { ASSOCIATION_RECRUIT_LEAD_STATUSES, type AssociationRecruitLeadStatus } from '@/features/associations/association-types';
import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const recruitLeadStatusSchema = z.enum(ASSOCIATION_RECRUIT_LEAD_STATUSES);

const recruitLeadRowSchema = z.object({
  association_name: z.string().nullable(),
  city: z.string().nullable(),
  closed_at: z.string().nullable(),
  contacted_at: z.string().nullable(),
  created_at: z.string(),
  id: z.string().uuid(),
  locale: z.enum(['en', 'fr']),
  message: z.string().nullable(),
  requester_email: z.string().nullable(),
  requester_name: z.string().nullable(),
  search_query: z.string(),
  status: recruitLeadStatusSchema
});

type AdminRecruitLeadsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    status?: string;
  };
};

type RecruitLeadRow = z.infer<typeof recruitLeadRowSchema>;

const copy = {
  en: {
    actionClose: 'Close lead',
    actionMarkContacted: 'Mark contacted',
    associationLabel: 'Association named by requester',
    badge: 'Directory growth',
    cityLabel: 'City / area',
    closedAtLabel: 'Closed',
    contactedAtLabel: 'Contacted',
    createdAtLabel: 'Captured',
    description:
      'Follow public searches that did not return enough useful directory coverage. These leads help Kamga invite real associations without inventing records from mockups.',
    emptyState: 'No recruit lead matches this filter.',
    filters: {
      all: 'All',
      closed: 'Closed',
      contacted: 'Contacted',
      new: 'New'
    },
    messageLabel: 'Context',
    notAvailable: 'Not available',
    requesterLabel: 'Requester',
    searchLabel: 'Search query',
    statuses: {
      closed: 'Closed',
      contacted: 'Contacted',
      new: 'New'
    },
    title: 'Recruit leads'
  },
  fr: {
    actionClose: 'Clôturer la piste',
    actionMarkContacted: 'Marquer comme contactée',
    associationLabel: 'Association indiquée',
    badge: 'Croissance annuaire',
    cityLabel: 'Ville / zone',
    closedAtLabel: 'Clôturée',
    contactedAtLabel: 'Contactée',
    createdAtLabel: 'Capturée',
    description:
      'Suivez les recherches publiques qui n’ont pas retourné une couverture utile suffisante. Ces pistes permettent à Kamga d’inviter de vraies associations sans fabriquer de fiches depuis les maquettes.',
    emptyState: 'Aucune piste ne correspond à ce filtre.',
    filters: {
      all: 'Toutes',
      closed: 'Clôturées',
      contacted: 'Contactées',
      new: 'Nouvelles'
    },
    messageLabel: 'Contexte',
    notAvailable: 'Non disponible',
    requesterLabel: 'Demandeur',
    searchLabel: 'Recherche',
    statuses: {
      closed: 'Clôturée',
      contacted: 'Contactée',
      new: 'Nouvelle'
    },
    title: 'Pistes annuaire'
  }
} as const;

function statusFilter(value: string | undefined): AssociationRecruitLeadStatus | 'all' {
  const parsed = recruitLeadStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'new';
}

async function listRecruitLeads(status: AssociationRecruitLeadStatus | 'all'): Promise<RecruitLeadRow[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('association_recruit_leads')
    .select('id,search_query,city,locale,association_name,requester_name,requester_email,message,status,created_at,contacted_at,closed_at')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.limit(100);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = recruitLeadRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function RecruitLeadActionForm({ action, label, leadId, locale, variant }: { action: (formData: FormData) => Promise<void>; label: string; leadId: string; locale: 'en' | 'fr'; variant: 'primary' | 'secondary' }) {
  return (
    <form action={action}>
      <input name="locale" type="hidden" value={locale} />
      <input name="recruitLeadId" type="hidden" value={leadId} />
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

export default async function AdminRecruitLeadsPage({ params, searchParams }: AdminRecruitLeadsPageProps) {
  const currentUser = await requirePlatformAdmin();
  const format = await getFormatter();
  const c = copy[params.locale];
  const currentStatus = statusFilter(searchParams.status);
  const filters: Array<AssociationRecruitLeadStatus | 'all'> = ['new', 'contacted', 'closed', 'all'];
  const leads = await listRecruitLeads(currentStatus);

  return (
    <AdminWorkspaceShell activeItem="recruitLeads" locale={params.locale} title={c.title} userEmail={currentUser.user.email}>
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
              href={{ pathname: '/admin/recruit-leads', query: { status: filter } }}
              key={filter}
            >
              <Search aria-hidden="true" size={14} />
              {c.filters[filter]}
            </Link>
          ))}
        </div>

        {leads.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{c.emptyState}</div>
        ) : (
          <div className="grid gap-4">
            {leads.map((lead) => {
              const createdAt = format.dateTime(new Date(lead.created_at), { dateStyle: 'medium', timeStyle: 'short' });
              const contactedAt = lead.contacted_at === null ? c.notAvailable : format.dateTime(new Date(lead.contacted_at), { dateStyle: 'medium', timeStyle: 'short' });
              const closedAt = lead.closed_at === null ? c.notAvailable : format.dateTime(new Date(lead.closed_at), { dateStyle: 'medium', timeStyle: 'short' });

              return (
                <article className="grid gap-5 rounded-md border border-border bg-raised p-5 shadow-card" key={lead.id}>
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted">{c.searchLabel}</p>
                      <h2 className="text-xl font-semibold text-heading">{lead.search_query || lead.association_name || c.notAvailable}</h2>
                      <p className="text-sm text-secondary">{lead.city ?? c.notAvailable}</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sunken px-3 py-1 text-sm font-semibold text-heading">
                      <Megaphone aria-hidden="true" size={15} />
                      {c.statuses[lead.status]}
                    </span>
                  </div>

                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="font-medium text-secondary">{c.associationLabel}</dt>
                      <dd className="mt-1 text-heading">{lead.association_name ?? c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.requesterLabel}</dt>
                      <dd className="mt-1 break-words text-heading">{[lead.requester_name, lead.requester_email].filter(Boolean).join(' · ') || c.notAvailable}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{c.createdAtLabel}</dt>
                      <dd className="mt-1 text-heading">{createdAt}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{lead.status === 'closed' ? c.closedAtLabel : c.contactedAtLabel}</dt>
                      <dd className="mt-1 text-heading">{lead.status === 'closed' ? closedAt : contactedAt}</dd>
                    </div>
                  </dl>

                  <div className="rounded-sm border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-heading">{c.messageLabel}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-secondary">{lead.message ?? c.notAvailable}</p>
                  </div>

                  {lead.status === 'closed' ? null : (
                    <div className="flex flex-wrap gap-3">
                      {lead.status !== 'contacted' ? (
                        <RecruitLeadActionForm action={markRecruitLeadContacted} label={c.actionMarkContacted} leadId={lead.id} locale={params.locale} variant="primary" />
                      ) : null}
                      <RecruitLeadActionForm action={closeRecruitLead} label={c.actionClose} leadId={lead.id} locale={params.locale} variant="secondary" />
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