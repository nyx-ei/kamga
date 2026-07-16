'use client';

import { useTranslations } from 'next-intl';
import { Building2, UploadCloud } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { registerAssociation } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

type AssociationRegistrationFormProps = {
  locale: 'en' | 'fr';
};

const initialState: AssociationActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('associations.registration');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Building2 aria-hidden="true" size={16} />
      {pending ? t('submitting') : t('submit')}
    </button>
  );
}

function actionMessage(state: AssociationActionState): string | null {
  if (state.ok) {
    return null;
  }

  return state.code;
}

export function AssociationRegistrationForm({ locale }: AssociationRegistrationFormProps) {
  const t = useTranslations('associations.registration');
  const [state, formAction] = useFormState(registerAssociation, initialState);
  const messageCode = actionMessage(state);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input name="locale" type="hidden" value={locale} />

      {messageCode === null ? null : (
        <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">
          {t(`errors.${messageCode}`)} ({messageCode})
        </p>
      )}

      <div className="grid gap-2">
        <label className="text-sm font-medium text-heading" htmlFor="association-name">
          {t('nameLabel')}
        </label>
        <input
          className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
          id="association-name"
          maxLength={180}
          name="name"
          placeholder={t('namePlaceholder')}
          required
          type="text"
        />
        {!state.ok && state.fieldErrors?.name !== undefined ? (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${state.fieldErrors.name}`)} ({state.fieldErrors.name})
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-heading" htmlFor="association-city">
          {t('cityLabel')}
        </label>
        <input
          className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
          id="association-city"
          maxLength={120}
          name="city"
          placeholder={t('cityPlaceholder')}
          required
          type="text"
        />
        {!state.ok && state.fieldErrors?.city !== undefined ? (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${state.fieldErrors.city}`)} ({state.fieldErrors.city})
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-heading" htmlFor="association-contact-email">
          {t('contactEmailLabel')}
        </label>
        <input
          className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
          id="association-contact-email"
          maxLength={254}
          name="contactEmail"
          placeholder={t('contactEmailPlaceholder')}
          required
          type="email"
        />
        {!state.ok && state.fieldErrors?.contactEmail !== undefined ? (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${state.fieldErrors.contactEmail}`)} ({state.fieldErrors.contactEmail})
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-heading" htmlFor="association-proof">
          {t('proofLabel')}
        </label>
        <div className="flex flex-col gap-3 rounded-md border border-border bg-sunken p-4">
          <div className="flex items-start gap-3 text-sm text-secondary">
            <UploadCloud aria-hidden="true" className="mt-1 shrink-0 text-muted" size={18} />
            <p>{t('proofHelp')}</p>
          </div>
          <input
            accept="application/pdf,image/jpeg,image/png"
            className="text-sm text-body file:mr-3 file:rounded-sm file:border file:border-border file:bg-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-body"
            id="association-proof"
            name="rpnAffiliationProof"
            required
            type="file"
          />
        </div>
        {!state.ok && state.fieldErrors?.rpnAffiliationProof !== undefined ? (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${state.fieldErrors.rpnAffiliationProof}`)} ({state.fieldErrors.rpnAffiliationProof})
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
