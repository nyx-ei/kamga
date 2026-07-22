'use client';

import { GitMerge } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { mergeAssociationRecords } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

type AssociationMergeOption = {
  city: string;
  id: string;
  label: string;
  source: string;
  status: string;
};

type AdminAssociationMergeFormProps = {
  association: AssociationMergeOption;
  copy: {
    description: string;
    duplicateLabel: string;
    errors: Record<string, string>;
    mergeAction: string;
    merged: string;
    noDuplicateOptions: string;
    pendingAction: string;
    title: string;
    warning: string;
  };
  locale: 'en' | 'fr';
  options: AssociationMergeOption[];
};

const initialState: AssociationActionState = { ok: true };

function MergeSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-warning/30 bg-warning-bg px-4 py-2 text-sm font-semibold text-warning transition hover:border-warning disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <GitMerge aria-hidden="true" size={16} />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminAssociationMergeForm({ association, copy, locale, options }: AdminAssociationMergeFormProps) {
  const [state, formAction] = useFormState(mergeAssociationRecords, initialState);
  const duplicateOptions = options.filter((option) => option.id !== association.id);

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-warning/20 bg-warning-bg/40 p-5 shadow-card">
      <input name="canonicalAssociationId" type="hidden" value={association.id} />
      <input name="locale" type="hidden" value={locale} />

      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase text-warning">{copy.title}</p>
        <p className="text-sm leading-6 text-secondary">{copy.description}</p>
        <p className="text-sm leading-6 text-warning">{copy.warning}</p>
      </div>

      {state.ok && state.submitted ? <p className="rounded-sm border border-positive/20 bg-positive-bg px-4 py-3 text-sm font-semibold text-positive">{copy.merged}</p> : null}
      {!state.ok ? (
        <p className="rounded-sm border border-negative/20 bg-negative-bg px-4 py-3 text-sm font-semibold text-negative">
          {copy.errors[state.code] ?? copy.errors['KMG-SYS-000']} ({state.code})
        </p>
      ) : null}

      {duplicateOptions.length === 0 ? (
        <p className="rounded-sm border border-border bg-sunken px-4 py-3 text-sm text-secondary">{copy.noDuplicateOptions}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.duplicateLabel}
            <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" name="duplicateAssociationId" required>
              <option value="">-</option>
              {duplicateOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} - {option.city} - {option.status} - {option.source}
                </option>
              ))}
            </select>
          </label>
          <MergeSubmitButton label={copy.mergeAction} pendingLabel={copy.pendingAction} />
        </div>
      )}
    </form>
  );
}