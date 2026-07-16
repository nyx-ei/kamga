'use client';

import { useTranslations } from 'next-intl';
import { FileQuestion } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { requestMoreEvidence } from '@/features/memberships/actions';
import type { MembershipActionState } from '@/features/memberships/membership-types';

type RequestEvidenceFormProps = {
  locale: 'en' | 'fr';
  membershipId: string;
};

const initialState: MembershipActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('memberships.review');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <FileQuestion aria-hidden="true" size={16} />
      {pending ? t('decisionPending') : t('requestEvidenceAction')}
    </button>
  );
}

export function RequestEvidenceForm({ locale, membershipId }: RequestEvidenceFormProps) {
  const t = useTranslations('memberships.review');
  const [state, action] = useFormState(requestMoreEvidence, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-md border border-border bg-sunken p-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-secondary">{t('requestEvidenceLabel')}</legend>
        <label className="flex items-center gap-2 text-sm text-body">
          <input className="size-4" name="evidenceTypes" type="checkbox" value="government_id" />
          {t('evidenceTypes.government_id')}
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input className="size-4" name="evidenceTypes" type="checkbox" value="immigration_proof" />
          {t('evidenceTypes.immigration_proof')}
        </label>
      </fieldset>
      <SubmitButton />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}
