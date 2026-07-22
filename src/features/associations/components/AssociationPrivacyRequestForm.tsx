'use client';

import { ShieldCheck } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { submitAssociationPrivacyRequest } from '@/features/associations/actions';
import type { AssociationActionState, AssociationPrivacyRequestType } from '@/features/associations/association-types';

type AssociationPrivacyRequestFormProps = {
  associationId: string;
  copy: {
    description: string;
    errors: Record<string, string>;
    reasonLabel: string;
    reasonPlaceholder: string;
    requestAction: string;
    requestPending: string;
    requestSubmitted: string;
    requestTypes: Record<AssociationPrivacyRequestType, string>;
    title: string;
    typeLabel: string;
  };
  locale: 'en' | 'fr';
};

const initialState: AssociationActionState = { ok: true };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <ShieldCheck aria-hidden="true" size={16} />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AssociationPrivacyRequestForm({ associationId, copy, locale }: AssociationPrivacyRequestFormProps) {
  const [state, formAction] = useFormState(submitAssociationPrivacyRequest, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-border bg-card p-6 shadow-card">
      <input name="associationId" type="hidden" value={associationId} />
      <input name="locale" type="hidden" value={locale} />

      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase text-muted">{copy.title}</p>
        <p className="text-sm leading-6 text-secondary">{copy.description}</p>
      </div>

      {state.ok && state.submitted ? <p className="rounded-sm border border-positive/20 bg-positive-bg px-4 py-3 text-sm font-semibold text-positive">{copy.requestSubmitted}</p> : null}
      {!state.ok ? (
        <p className="rounded-sm border border-negative/20 bg-negative-bg px-4 py-3 text-sm font-semibold text-negative">
          {copy.errors[state.code] ?? copy.errors['KMG-SYS-000']} ({state.code})
        </p>
      ) : null}

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.typeLabel}
        <select className="h-11 rounded-sm border border-input bg-raised px-3 text-sm text-body shadow-card focus:border-focus" name="requestType" required>
          {Object.entries(copy.requestTypes).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.reasonLabel}
        <textarea className="min-h-24 rounded-sm border border-input bg-raised px-4 py-3 text-sm text-body shadow-card focus:border-focus" maxLength={1200} name="reason" placeholder={copy.reasonPlaceholder} />
      </label>

      <SubmitButton label={copy.requestAction} pendingLabel={copy.requestPending} />
    </form>
  );
}