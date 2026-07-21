'use client';

import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { submitAssociationConnectRequest } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

const initialState: AssociationActionState = { ok: true };

type RequestToConnectAssociationFormProps = {
  associationId: string;
  locale: 'en' | 'fr';
};

function SubmitButton({ submitted }: { submitted: boolean }) {
  const t = useTranslations('associations.connect');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending || submitted}
      type="submit"
    >
      <Mail aria-hidden="true" size={16} />
      {submitted ? t('sentAction') : pending ? t('submitting') : t('action')}
    </button>
  );
}

export function RequestToConnectAssociationForm({ associationId, locale }: RequestToConnectAssociationFormProps) {
  const t = useTranslations('associations.connect');
  const [state, action] = useFormState(submitAssociationConnectRequest, initialState);
  const submitted = state.ok && state.submitted === true;

  return (
    <form action={action} className="grid gap-5 rounded-md border border-border bg-sunken p-5">
      <input name="associationId" type="hidden" value={associationId} />
      <input name="locale" type="hidden" value={locale} />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-heading">{t('title')}</h2>
        <p className="text-sm leading-6 text-secondary">{t('description')}</p>
      </div>

      {submitted ? (
        <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('success')}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('nameLabel')}
          <input className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card" maxLength={140} name="requesterName" required type="text" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('emailLabel')}
          <input className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card" maxLength={254} name="requesterEmail" type="email" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {t('phoneLabel')}
        <input className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card" maxLength={40} name="requesterPhone" type="tel" />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {t('messageLabel')}
        <textarea className="min-h-32 rounded-sm border border-input bg-card px-3 py-3 text-sm text-body shadow-card" maxLength={1200} minLength={10} name="message" required />
      </label>

      <p className="rounded-sm border border-border bg-card px-4 py-3 text-sm leading-6 text-secondary">{t('privacyNotice')}</p>

      <SubmitButton submitted={submitted} />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}

