import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowLeft, Search } from 'lucide-react';
import { z } from 'zod';

import { Link } from '@/i18n/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const memberStatusSchema = z.enum(['pending', 'needs_more_evidence', 'active', 'declined']);

const memberRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  status: memberStatusSchema,
  associations: z.object({ name: z.string() }).nullable(),
  users: z
    .object({
      email: z.string().nullable(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable()
    })
    .nullable()
});

type AdminMembersPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    status?: string;
  };
};

type MemberRow = z.infer<typeof memberRowSchema>;

function statusFilter(value: string | undefined): z.infer<typeof memberStatusSchema> | 'all' {
  const parsed = memberStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'pending';
}

async function listMembers(status: z.infer<typeof memberStatusSchema> | 'all'): Promise<MemberRow[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('association_members')
    .select('id,created_at,status,associations:association_id(name),users:user_id(first_name,last_name,email)')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = memberRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export default async function AdminMembersPage({ params, searchParams }: AdminMembersPageProps) {
  await requirePlatformAdmin();

  const t = await getTranslations('memberships.adminMembers');
  const format = await getFormatter();
  const currentStatus = statusFilter(searchParams.status);
  const members = await listMembers(currentStatus);
  const filters: Array<z.infer<typeof memberStatusSchema> | 'all'> = ['pending', 'needs_more_evidence', 'active', 'declined', 'all'];

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/admin"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {t('backToAdmin')}
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              className={
                filter === currentStatus
                  ? 'inline-flex items-center gap-2 rounded-sm bg-brand px-3 py-2 text-sm font-medium text-on-brand shadow-card'
                  : 'inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong'
              }
              href={{ pathname: '/admin/members', query: { status: filter } }}
              key={filter}
            >
              <Search aria-hidden="true" size={14} />
              {t(`filters.${filter}`)}
            </Link>
          ))}
        </div>

        {members.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('emptyState')}</div>
        ) : (
          <div className="grid gap-4">
            {members.map((member) => {
              const fullName = [member.users?.first_name, member.users?.last_name].filter(Boolean).join(' ');

              return (
                <article className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card" key={member.id}>
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted">{member.associations?.name ?? t('unknownAssociation')}</p>
                      <h2 className="text-xl font-semibold text-heading">{fullName.length > 0 ? fullName : t('unknownMember')}</h2>
                      <p className="text-sm text-secondary">{member.users?.email ?? t('notProvided')}</p>
                    </div>
                    <Link
                      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
                      href={`/admin/members/${member.id}`}
                    >
                      {t('reviewAction')}
                    </Link>
                  </div>
                  <dl className="grid gap-3 rounded-sm border border-border bg-sunken p-4 text-sm md:grid-cols-2">
                    <div>
                      <dt className="font-medium text-secondary">{t('statusLabel')}</dt>
                      <dd className="mt-1 text-heading">{t(`statuses.${member.status}`)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-secondary">{t('submittedAtLabel')}</dt>
                      <dd className="mt-1 text-heading">{format.dateTime(new Date(member.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
