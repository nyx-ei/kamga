'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { approveMember } from '@/features/memberships/actions';
import type { MembershipActionState } from '@/features/memberships/membership-types';

type ApproveMemberFormProps = {
  locale: 'en' | 'fr';
  membershipId: string;
};

const initialState: MembershipActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('memberships.review');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <CheckCircle2 aria-hidden="true" size={16} />
      {pending ? t('decisionPending') : t('approveAction')}
    </button>
  );
}

export function ApproveMemberForm({ locale, membershipId }: ApproveMemberFormProps) {
  const t = useTranslations('memberships.review');
  const [state, action] = useFormState(approveMember, initialState);

  return (
    <form action={action} className="grid gap-3">
      <input name="locale" type="hidden" value={locale} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <SubmitButton />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}
