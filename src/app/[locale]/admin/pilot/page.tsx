import { getFormatter, getTranslations } from 'next-intl/server';
import { CheckCircle2, CircleDashed, MessageSquare, UsersRound } from 'lucide-react';
import { z } from 'zod';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import {
  AddPilotAssociationForm,
  PilotAssociationUpdateForm,
  PilotFeedbackForm,
  PilotFeedbackReviewForm
} from '@/features/pilot';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const pilotAssociationSchema = z.object({
  association_id: z.string().uuid(),
  associations: z.union([z.object({ city: z.string(), contact_email: z.string().nullable(), name: z.string(), status: z.string() }), z.array(z.object({ city: z.string(), contact_email: z.string().nullable(), name: z.string(), status: z.string() }))]).nullable(),
  created_at: z.string(),
  data_migration_completed_at: z.string().nullable(),
  data_migration_status: z.enum(['not_started', 'in_progress', 'completed', 'blocked']),
  guided_setup_status: z.enum(['not_started', 'in_progress', 'completed']),
  id: z.string().uuid(),
  notes: z.string().nullable(),
  pilot_feedback: z
    .array(
      z.object({
        category: z.enum(['onboarding', 'data_migration', 'member_flow', 'payments', 'general']),
        created_at: z.string(),
        feedback: z.string(),
        id: z.string().uuid(),
        iteration_notes: z.string().nullable(),
        rating: z.number().int().nullable(),
        reviewed_at: z.string().nullable()
      })
    )
    .nullable(),
  setup_completed_at: z.string().nullable(),
  status: z.enum(['onboarding', 'active_pilot', 'iteration', 'completed', 'paused'])
});

const associationOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
});

type AdminPilotPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

type PilotAssociation = z.infer<typeof pilotAssociationSchema>;

function pilotAssociationDetails(pilot: PilotAssociation) {
  return Array.isArray(pilot.associations) ? (pilot.associations[0] ?? null) : pilot.associations;
}

async function listPilotAssociations(): Promise<PilotAssociation[]> {
  const { data, error } = await createSupabaseServerClient()
    .from('pilot_associations')
    .select(
      'id,association_id,status,guided_setup_status,data_migration_status,notes,setup_completed_at,data_migration_completed_at,created_at,associations:association_id(name,city,contact_email,status),pilot_feedback(id,category,rating,feedback,iteration_notes,reviewed_at,created_at)'
    )
    .order('created_at', { ascending: false });

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = pilotAssociationSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

async function listAvailableAssociations(pilotAssociationIds: string[]): Promise<Array<{ id: string; name: string }>> {
  let query = createSupabaseServerClient().from('associations').select('id,name').order('name', { ascending: true });

  if (pilotAssociationIds.length > 0) {
    query = query.not('id', 'in', `(${pilotAssociationIds.join(',')})`);
  }

  const { data, error } = await query;

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = associationOptionSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function completionPercent(pilotAssociations: PilotAssociation[]): number {
  if (pilotAssociations.length === 0) {
    return 0;
  }

  const completedSignals = pilotAssociations.reduce((total, pilot) => {
    const setup = pilot.guided_setup_status === 'completed' ? 1 : 0;
    const migration = pilot.data_migration_status === 'completed' ? 1 : 0;
    const feedback = (pilot.pilot_feedback ?? []).length > 0 ? 1 : 0;
    return total + setup + migration + feedback;
  }, 0);

  return Math.round((completedSignals / (pilotAssociations.length * 3)) * 100);
}

export default async function AdminPilotPage({ params }: AdminPilotPageProps) {
  const currentUser = await requirePlatformAdmin();
  const t = await getTranslations('pilot.admin');
  const format = await getFormatter();
  const pilotAssociations = await listPilotAssociations();
  const availableAssociations = await listAvailableAssociations(pilotAssociations.map((pilot) => pilot.association_id));
  const pilotPercent = completionPercent(pilotAssociations);
  const reviewedFeedbackCount = pilotAssociations.reduce(
    (total, pilot) => total + (pilot.pilot_feedback ?? []).filter((feedback) => feedback.reviewed_at !== null).length,
    0
  );
  const feedbackCount = pilotAssociations.reduce((total, pilot) => total + (pilot.pilot_feedback ?? []).length, 0);

  return (
    <AdminWorkspaceShell activeItem="pilot" locale={params.locale} title={t('title')} userEmail={currentUser.user.email}>
      <section className="grid gap-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <p className="max-w-3xl text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted">{t('progressTitle')}</p>
              <p className="text-xl font-semibold text-heading">{pilotPercent}%</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-sm bg-sunken">
              <div className="h-full bg-brand" style={{ width: `${pilotPercent}%` }} />
            </div>
            <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-secondary">{t('pilotCountLabel')}</dt>
                <dd className="mt-1 font-mono text-lg text-heading">{pilotAssociations.length}/5</dd>
              </div>
              <div>
                <dt className="text-secondary">{t('setupDoneLabel')}</dt>
                <dd className="mt-1 font-mono text-lg text-heading">{pilotAssociations.filter((pilot) => pilot.guided_setup_status === 'completed').length}</dd>
              </div>
              <div>
                <dt className="text-secondary">{t('feedbackReviewedLabel')}</dt>
                <dd className="mt-1 font-mono text-lg text-heading">
                  {reviewedFeedbackCount}/{feedbackCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <AddPilotAssociationForm associations={availableAssociations} disabled={pilotAssociations.length >= 5} locale={params.locale} />

        {pilotAssociations.length === 0 ? (
          <div className="rounded-md border border-border bg-sunken p-6 text-sm leading-6 text-secondary">{t('emptyState')}</div>
        ) : (
          <div className="grid gap-5">
            {pilotAssociations.map((pilot) => {
              const feedback = pilot.pilot_feedback ?? [];
              const association = pilotAssociationDetails(pilot);
              const associationName = association?.name ?? t('unknownAssociation');

              return (
                <article className="grid gap-5 rounded-md border border-border bg-card p-5 shadow-card" key={pilot.id}>
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">{t(`statuses.${pilot.status}`)}</p>
                      <h2 className="mt-1 text-2xl font-semibold text-heading">{associationName}</h2>
                      <p className="mt-1 text-sm text-secondary">
                        {association?.city ?? t('notAvailable')} · {association?.contact_email ?? t('notAvailable')}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm md:grid-cols-3">
                      <span className="inline-flex items-center gap-2 rounded-sm border border-border bg-sunken px-3 py-2 text-heading">
                        {pilot.guided_setup_status === 'completed' ? <CheckCircle2 aria-hidden="true" size={15} /> : <CircleDashed aria-hidden="true" size={15} />}
                        {t(`workflowStatuses.${pilot.guided_setup_status}`)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-sm border border-border bg-sunken px-3 py-2 text-heading">
                        {pilot.data_migration_status === 'completed' ? <CheckCircle2 aria-hidden="true" size={15} /> : <CircleDashed aria-hidden="true" size={15} />}
                        {t(`migrationStatuses.${pilot.data_migration_status}`)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-sm border border-border bg-sunken px-3 py-2 text-heading">
                        <MessageSquare aria-hidden="true" size={15} />
                        {feedback.length}
                      </span>
                    </div>
                  </div>

                  <PilotAssociationUpdateForm
                    dataMigrationStatus={pilot.data_migration_status}
                    guidedSetupStatus={pilot.guided_setup_status}
                    locale={params.locale}
                    notes={pilot.notes}
                    pilotAssociationId={pilot.id}
                    status={pilot.status}
                  />

                  <section className="grid gap-4 rounded-sm border border-border bg-sunken p-4">
                    <div>
                      <h3 className="text-lg font-semibold text-heading">{t('feedbackTitle')}</h3>
                      <p className="mt-1 text-sm leading-6 text-secondary">{t('feedbackDescription')}</p>
                    </div>
                    <PilotFeedbackForm locale={params.locale} pilotAssociationId={pilot.id} />
                    {feedback.length === 0 ? (
                      <div className="rounded-sm border border-border bg-card p-4 text-sm text-secondary">{t('feedbackEmpty')}</div>
                    ) : (
                      <div className="grid gap-3">
                        {feedback.map((item) => (
                          <div className="grid gap-3 rounded-sm border border-border bg-card p-4" key={item.id}>
                            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted">{t(`feedbackCategories.${item.category}`)}</p>
                                <p className="mt-2 text-sm leading-6 text-heading">{item.feedback}</p>
                                {item.iteration_notes === null ? null : <p className="mt-2 text-sm leading-6 text-secondary">{item.iteration_notes}</p>}
                              </div>
                              <div className="text-sm text-secondary">
                                <p>{format.dateTime(new Date(item.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                <p>{item.rating === null ? t('ratingEmpty') : t('ratingValue', { rating: item.rating })}</p>
                              </div>
                            </div>
                            {item.reviewed_at === null ? (
                              <PilotFeedbackReviewForm feedbackId={item.id} locale={params.locale} />
                            ) : (
                              <p className="inline-flex w-fit items-center gap-2 rounded-sm bg-positive-bg px-3 py-2 text-sm font-medium text-positive">
                                <CheckCircle2 aria-hidden="true" size={15} />
                                {t('reviewedLabel')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </article>
              );
            })}
          </div>
        )}

        <div className="rounded-md border border-border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <UsersRound aria-hidden="true" className="mt-1 text-brand-strong" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-heading">{t('operatingModelTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">{t('operatingModelDescription')}</p>
            </div>
          </div>
        </div>
      </section>
    </AdminWorkspaceShell>
  );
}
