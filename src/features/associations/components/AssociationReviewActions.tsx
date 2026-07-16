'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, PauseCircle } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { approveAssociation, suspendAssociation } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

type AssociationReviewActionsProps = {
  associationId: string;
  locale: 'en' | 'fr';
};

const initialState: AssociationActionState = { ok: true };

function DecisionButton({ action }: { action: 'approve' | 'suspend' }) {
  const t = useTranslations('associations.admin');
  const { pending } = useFormStatus();
  const Icon = action === 'approve' ? CheckCircle2 : PauseCircle;

  return (
    <button
      className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Icon aria-hidden="true" size={16} />
      {pending ? t('decisionPending') : t(`${action}Action`)}
    </button>
  );
}

function ActionError({ state }: { state: AssociationActionState }) {
  const t = useTranslations('associations.admin');

  if (state.ok) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-negative">
      {t(`errors.${state.code}`)} ({state.code})
    </p>
  );
}

export function AssociationReviewActions({ associationId, locale }: AssociationReviewActionsProps) {
  const [approveState, approveAction] = useFormState(approveAssociation, initialState);
  const [suspendState, suspendAction] = useFormState(suspendAssociation, initialState);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={approveAction}>
          <input name="associationId" type="hidden" value={associationId} />
          <input name="locale" type="hidden" value={locale} />
          <DecisionButton action="approve" />
        </form>
        <form action={suspendAction}>
          <input name="associationId" type="hidden" value={associationId} />
          <input name="locale" type="hidden" value={locale} />
          <DecisionButton action="suspend" />
        </form>
      </div>
      <ActionError state={approveState} />
      <ActionError state={suspendState} />
    </div>
  );
}
