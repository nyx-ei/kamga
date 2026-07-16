'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { reviewMembership } from '@/features/memberships/actions';
import type { MembershipActionState, MembershipReviewDecision } from '@/features/memberships/membership-types';

type MembershipReviewActionsProps = {
  membershipId: string;
  locale: 'en' | 'fr';
};

const initialState: MembershipActionState = { ok: true };

function DecisionButton({ decision }: { decision: MembershipReviewDecision }) {
  const t = useTranslations('memberships.admin');
  const { pending } = useFormStatus();
  const Icon = decision === 'active' ? CheckCircle2 : XCircle;

  return (
    <button
      className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Icon aria-hidden="true" size={16} />
      {pending ? t('decisionPending') : t(`${decision}Action`)}
    </button>
  );
}

function ActionError({ state }: { state: MembershipActionState }) {
  const t = useTranslations('memberships.admin');

  if (state.ok) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-negative">
      {t(`errors.${state.code}`)} ({state.code})
    </p>
  );
}

export function MembershipReviewActions({ membershipId, locale }: MembershipReviewActionsProps) {
  const [approveState, approveAction] = useFormState(reviewMembership, initialState);
  const [declineState, declineAction] = useFormState(reviewMembership, initialState);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={approveAction}>
          <input name="decision" type="hidden" value="active" />
          <input name="locale" type="hidden" value={locale} />
          <input name="membershipId" type="hidden" value={membershipId} />
          <DecisionButton decision="active" />
        </form>
        <form action={declineAction}>
          <input name="decision" type="hidden" value="declined" />
          <input name="locale" type="hidden" value={locale} />
          <input name="membershipId" type="hidden" value={membershipId} />
          <DecisionButton decision="declined" />
        </form>
      </div>
      <ActionError state={approveState} />
      <ActionError state={declineState} />
    </div>
  );
}
