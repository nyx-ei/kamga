import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';

import { UploadEvidenceForm } from '@/features/evidence/components/UploadEvidenceForm';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const uploadMembershipSchema = z.object({
  id: z.string().uuid(),
  associations: z.object({ name: z.string() }).nullable()
});

type UploadEvidencePageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

async function listUploadableMemberships(userId: string): Promise<Array<{ associationName: string; id: string }>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_members')
    .select('id,associations:association_id(name)')
    .eq('user_id', userId)
    .in('status', ['pending', 'needs_more_evidence'])
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = uploadMembershipSchema.safeParse(row);

    if (!parsed.success) {
      return [];
    }

    return [
      {
        associationName: parsed.data.associations?.name ?? parsed.data.id,
        id: parsed.data.id
      }
    ];
  });
}

export default async function UploadEvidencePage({ params }: UploadEvidencePageProps) {
  const currentUser = await requireUser();
  const t = await getTranslations('evidence.upload');
  const memberships = await listUploadableMemberships(currentUser.user.id);

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-4xl flex-col gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/dashboard"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {t('backToDashboard')}
          </Link>
        </div>

        {memberships.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('emptyState')}</div>
        ) : (
          <UploadEvidenceForm locale={params.locale} memberships={memberships} />
        )}
      </section>
    </main>
  );
}
