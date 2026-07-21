'use client';

import { ShieldCheck } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { claimAssociation } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

type ClaimAssociationFormProps = {
  associationId: string;
  copy: {
    action: string;
    authorized: string;
    contactEmailLabel: string;
    contactEmailPlaceholder: string;
    errors: Record<string, string>;
    registryLabel: string;
    registryPlaceholder: string;
    submitting: string;
  };
  locale: 'en' | 'fr';
};

const initialState: AssociationActionState = { ok: true };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <ShieldCheck aria-hidden="true" size={16} />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ClaimAssociationForm({ associationId, copy, locale }: ClaimAssociationFormProps) {
  const [state, formAction] = useFormState(claimAssociation, initialState);

  return (
    <form action={formAction} className="grid gap-5">
      <input name="associationId" type="hidden" value={associationId} />
      <input name="locale" type="hidden" value={locale} />

      {state.ok ? null : (
        <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">
          {copy.errors[state.code] ?? copy.errors['KMG-SYS-000']} ({state.code})
        </p>
      )}

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.registryLabel}
        <input
          className="h-12 rounded-sm border border-input bg-raised px-4 font-mono text-base text-body shadow-card transition placeholder:text-muted focus:border-focus"
          maxLength={64}
          name="registryNumber"
          placeholder={copy.registryPlaceholder}
          required
          type="text"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.contactEmailLabel}
        <input
          className="h-12 rounded-sm border border-input bg-raised px-4 text-base text-body shadow-card transition placeholder:text-muted focus:border-focus"
          maxLength={254}
          name="contactEmail"
          placeholder={copy.contactEmailPlaceholder}
          required
          type="email"
        />
      </label>

      <label className="inline-flex items-start gap-3 text-sm font-medium text-heading">
        <input className="mt-1 size-5" name="authorized" required type="checkbox" />
        {copy.authorized}
      </label>

      <SubmitButton label={copy.action} pendingLabel={copy.submitting} />
    </form>
  );
}
