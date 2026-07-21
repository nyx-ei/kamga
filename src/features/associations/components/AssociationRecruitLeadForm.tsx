'use client';

import { Building2, Send } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { submitAssociationRecruitLead } from '@/features/associations/actions';
import type { AssociationActionCode, AssociationActionState } from '@/features/associations/association-types';

const initialState: AssociationActionState = { ok: true };

type AssociationRecruitLeadFormCopy = {
  associationNameLabel: string;
  associationNamePlaceholder: string;
  cityLabel: string;
  emailLabel: string;
  messageLabel: string;
  messagePlaceholder: string;
  nameLabel: string;
  privacyNotice: string;
  submit: string;
  submitting: string;
  success: string;
  title: string;
  description: string;
  errors: Record<AssociationActionCode, string>;
};

type AssociationRecruitLeadFormProps = {
  city?: string | null;
  copy: AssociationRecruitLeadFormCopy;
  locale: 'en' | 'fr';
  searchQuery: string;
};

function SubmitButton({ copy, submitted }: { copy: AssociationRecruitLeadFormCopy; submitted: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending || submitted}
      type="submit"
    >
      <Send aria-hidden="true" size={16} />
      {submitted ? copy.success : pending ? copy.submitting : copy.submit}
    </button>
  );
}

export function AssociationRecruitLeadForm({ city, copy, locale, searchQuery }: AssociationRecruitLeadFormProps) {
  const [state, action] = useFormState(submitAssociationRecruitLead, initialState);
  const submitted = state.ok && state.submitted === true;
  const errorMessage = state.ok ? null : copy.errors[state.code] ?? copy.errors['KMG-SYS-000'];

  return (
    <form action={action} className="mt-8 grid gap-5 rounded-md border border-border bg-sunken p-5">
      <input name="city" type="hidden" value={city ?? ''} />
      <input name="locale" type="hidden" value={locale} />
      <input name="searchQuery" type="hidden" value={searchQuery} />

      <div className="flex gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-[#f1f4ff] text-[#3454b8]">
          <Building2 aria-hidden="true" size={22} />
        </span>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-heading">{copy.title}</h3>
          <p className="text-sm leading-6 text-secondary">{copy.description}</p>
        </div>
      </div>

      {submitted ? <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{copy.success}</p> : null}

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.associationNameLabel}
        <input className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card" maxLength={180} name="associationName" placeholder={copy.associationNamePlaceholder} type="text" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.nameLabel}
          <input className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card" maxLength={140} name="requesterName" type="text" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.emailLabel}
          <input className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card" maxLength={254} name="requesterEmail" type="email" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.messageLabel}
        <textarea className="min-h-28 rounded-sm border border-input bg-card px-3 py-3 text-sm text-body shadow-card" maxLength={1200} name="message" placeholder={copy.messagePlaceholder} />
      </label>

      <p className="rounded-sm border border-border bg-card px-4 py-3 text-sm leading-6 text-secondary">{copy.privacyNotice}</p>
      <SubmitButton copy={copy} submitted={submitted} />
      {errorMessage === null ? null : <p className="text-sm font-medium text-negative">{errorMessage}</p>}
    </form>
  );
}