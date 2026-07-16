'use client';

import { useTranslations } from 'next-intl';
import { XCircle } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { declineMember } from '@/features/memberships/actions';
import type { MembershipActionState } from '@/features/memberships/membership-types';

type DeclineFormProps = {
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
      <XCircle aria-hidden="true" size={16} />
      {pending ? t('decisionPending') : t('declineAction')}
    </button>
  );
}

export function DeclineForm({ locale, membershipId }: DeclineFormProps) {
  const t = useTranslations('memberships.review');
  const [state, action] = useFormState(declineMember, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-md border border-border bg-sunken p-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <label className="grid gap-2 text-sm font-medium text-secondary">
        {t('declineReasonLabel')}
        <textarea
          className="min-h-32 rounded-sm border border-input bg-card px-3 py-2 text-body"
          name="declineReasonHtml"
          placeholder={t('declineReasonPlaceholder')}
          required
        />
      </label>
      <p className="text-xs leading-5 text-muted">{t('declineReasonHelp')}</p>
      <SubmitButton />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}
