'use client';

import { useTranslations } from 'next-intl';
import { Check, MessageSquarePlus, Plus, Save } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { addPilotAssociation, addPilotFeedback, reviewPilotFeedback, updatePilotAssociation } from '@/features/pilot/actions';
import {
  PILOT_ASSOCIATION_STATUSES,
  PILOT_FEEDBACK_CATEGORIES,
  PILOT_MIGRATION_STATUSES,
  PILOT_WORKFLOW_STATUSES,
  type PilotActionState,
  type PilotAssociationStatus,
  type PilotFeedbackCategory,
  type PilotMigrationStatus,
  type PilotWorkflowStatus
} from '@/features/pilot/pilot-types';

type AddPilotAssociationFormProps = {
  associations: Array<{ id: string; name: string }>;
  disabled: boolean;
  locale: 'en' | 'fr';
};

type PilotAssociationUpdateFormProps = {
  dataMigrationStatus: PilotMigrationStatus;
  guidedSetupStatus: PilotWorkflowStatus;
  locale: 'en' | 'fr';
  notes: string | null;
  pilotAssociationId: string;
  status: PilotAssociationStatus;
};

type PilotFeedbackFormProps = {
  locale: 'en' | 'fr';
  pilotAssociationId: string;
};

type PilotFeedbackReviewFormProps = {
  feedbackId: string;
  locale: 'en' | 'fr';
};

const initialState: PilotActionState = { ok: true };

function SubmitButton({
  disabled = false,
  icon,
  label,
  pendingLabel
}: {
  disabled?: boolean;
  icon: 'check' | 'message' | 'plus' | 'save';
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const Icon = icon === 'plus' ? Plus : icon === 'message' ? MessageSquarePlus : icon === 'check' ? Check : Save;

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending || disabled}
      type="submit"
    >
      <Icon aria-hidden="true" size={16} />
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionError({ state }: { state: PilotActionState }) {
  const t = useTranslations('pilot.admin');

  if (state.ok) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-negative">
      {t(`errors.${state.code}`)} ({state.code})
    </p>
  );
}

export function AddPilotAssociationForm({ associations, disabled, locale }: AddPilotAssociationFormProps) {
  const t = useTranslations('pilot.admin');
  const [state, action] = useFormState(addPilotAssociation, initialState);
  const hasSelectableAssociations = associations.length > 0 && !disabled;

  return (
    <form action={action} className="grid gap-4 rounded-md border border-border bg-card p-5 shadow-card">
      <input name="locale" type="hidden" value={locale} />
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-heading" htmlFor="associationId">
          {t('associationLabel')}
        </label>
        <select className="rounded-sm border border-input bg-sunken px-3 py-2 text-body" disabled={!hasSelectableAssociations} id="associationId" name="associationId" required>
          {associations.length === 0 ? <option>{t('noAssociationsAvailable')}</option> : null}
          {associations.map((association) => (
            <option key={association.id} value={association.id}>
              {association.name}
            </option>
          ))}
        </select>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-heading">
        {t('notesLabel')}
        <textarea className="min-h-24 rounded-sm border border-input bg-sunken px-3 py-2 text-body" maxLength={1200} name="notes" placeholder={t('notesPlaceholder')} />
      </label>
      <ActionError state={state} />
      <SubmitButton disabled={disabled || associations.length === 0} icon="plus" label={disabled ? t('pilotLimitReached') : t('addAssociationAction')} pendingLabel={t('saving')} />
    </form>
  );
}

export function PilotAssociationUpdateForm({
  dataMigrationStatus,
  guidedSetupStatus,
  locale,
  notes,
  pilotAssociationId,
  status
}: PilotAssociationUpdateFormProps) {
  const t = useTranslations('pilot.admin');
  const [state, action] = useFormState(updatePilotAssociation, initialState);

  return (
    <form action={action} className="grid gap-4 rounded-sm border border-border bg-sunken p-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="pilotAssociationId" type="hidden" value={pilotAssociationId} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('pilotStatusLabel')}
          <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={status} name="status">
            {PILOT_ASSOCIATION_STATUSES.map((option) => (
              <option key={option} value={option}>
                {t(`statuses.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('guidedSetupLabel')}
          <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={guidedSetupStatus} name="guidedSetupStatus">
            {PILOT_WORKFLOW_STATUSES.map((option) => (
              <option key={option} value={option}>
                {t(`workflowStatuses.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('dataMigrationLabel')}
          <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={dataMigrationStatus} name="dataMigrationStatus">
            {PILOT_MIGRATION_STATUSES.map((option) => (
              <option key={option} value={option}>
                {t(`migrationStatuses.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-heading">
        {t('notesLabel')}
        <textarea className="min-h-24 rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={notes ?? ''} maxLength={1200} name="notes" />
      </label>
      <ActionError state={state} />
      <SubmitButton icon="save" label={t('saveProgressAction')} pendingLabel={t('saving')} />
    </form>
  );
}

export function PilotFeedbackForm({ locale, pilotAssociationId }: PilotFeedbackFormProps) {
  const t = useTranslations('pilot.admin');
  const [state, action] = useFormState(addPilotFeedback, initialState);

  return (
    <form action={action} className="grid gap-4 rounded-sm border border-border bg-card p-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="pilotAssociationId" type="hidden" value={pilotAssociationId} />
      <div className="grid gap-3 md:grid-cols-[1fr_160px]">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('feedbackCategoryLabel')}
          <select className="rounded-sm border border-input bg-sunken px-3 py-2 text-body" name="category">
            {PILOT_FEEDBACK_CATEGORIES.map((category: PilotFeedbackCategory) => (
              <option key={category} value={category}>
                {t(`feedbackCategories.${category}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('ratingLabel')}
          <select className="rounded-sm border border-input bg-sunken px-3 py-2 text-body" name="rating">
            <option value="">{t('ratingEmpty')}</option>
            {[1, 2, 3, 4, 5].map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-heading">
        {t('feedbackLabel')}
        <textarea className="min-h-24 rounded-sm border border-input bg-sunken px-3 py-2 text-body" maxLength={2500} name="feedback" required />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-heading">
        {t('iterationNotesLabel')}
        <textarea className="min-h-20 rounded-sm border border-input bg-sunken px-3 py-2 text-body" maxLength={1500} name="iterationNotes" />
      </label>
      <ActionError state={state} />
      <SubmitButton icon="message" label={t('addFeedbackAction')} pendingLabel={t('saving')} />
    </form>
  );
}

export function PilotFeedbackReviewForm({ feedbackId, locale }: PilotFeedbackReviewFormProps) {
  const t = useTranslations('pilot.admin');
  const [state, action] = useFormState(reviewPilotFeedback, initialState);

  return (
    <form action={action}>
      <input name="feedbackId" type="hidden" value={feedbackId} />
      <input name="locale" type="hidden" value={locale} />
      <SubmitButton icon="check" label={t('markReviewedAction')} pendingLabel={t('saving')} />
      <ActionError state={state} />
    </form>
  );
}
