'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { resolveAssociationPrivacyRequest } from '@/features/associations/actions';
import type { AssociationActionState, AssociationPrivacyRequestDecision } from '@/features/associations/association-types';

type AdminPrivacyRequestDecisionFormProps = {
  copy: {
    errors: Record<string, string>;
    noteLabel: string;
    notePlaceholder: string;
    pending: string;
    resolved: string;
    submit: Record<AssociationPrivacyRequestDecision, string>;
  };
  decision: AssociationPrivacyRequestDecision;
  locale: 'en' | 'fr';
  requestId: string;
};

const initialState: AssociationActionState = { ok: true };

function SubmitButton({ decision, label, pendingLabel }: { decision: AssociationPrivacyRequestDecision; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  const Icon = decision === 'completed' ? CheckCircle2 : XCircle;
  const className =
    decision === 'completed'
      ? 'inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70'
      : 'inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70';

  return (
    <button className={className} disabled={pending} type="submit">
      <Icon aria-hidden="true" size={16} />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminPrivacyRequestDecisionForm({ copy, decision, locale, requestId }: AdminPrivacyRequestDecisionFormProps) {
  const [state, formAction] = useFormState(resolveAssociationPrivacyRequest, initialState);

  return (
    <form action={formAction} className="grid gap-3 rounded-sm border border-border bg-card p-4">
      <input name="decision" type="hidden" value={decision} />
      <input name="locale" type="hidden" value={locale} />
      <input name="privacyRequestId" type="hidden" value={requestId} />

      {state.ok && state.submitted ? <p className="text-sm font-semibold text-positive">{copy.resolved}</p> : null}
      {!state.ok ? <p className="text-sm font-semibold text-negative">{copy.errors[state.code] ?? copy.errors['KMG-SYS-000']} ({state.code})</p> : null}

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.noteLabel}
        <textarea className="min-h-20 rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body focus:border-focus" maxLength={1200} name="note" placeholder={copy.notePlaceholder} />
      </label>

      <SubmitButton decision={decision} label={copy.submit[decision]} pendingLabel={copy.pending} />
    </form>
  );
}