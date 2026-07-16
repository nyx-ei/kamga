'use client';

import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { uploadAdditionalEvidence } from '@/features/evidence/actions';
import type { EvidenceActionState } from '@/features/evidence/evidence-types';

type UploadEvidenceFormProps = {
  locale: 'en' | 'fr';
  memberships: Array<{
    associationName: string;
    id: string;
  }>;
};

const initialState: EvidenceActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('evidence.upload');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Upload aria-hidden="true" size={16} />
      {pending ? t('submitting') : t('submit')}
    </button>
  );
}

export function UploadEvidenceForm({ locale, memberships }: UploadEvidenceFormProps) {
  const t = useTranslations('evidence.upload');
  const [state, action] = useFormState(uploadAdditionalEvidence, initialState);

  return (
    <form action={action} className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
      <input name="locale" type="hidden" value={locale} />
      <label className="grid gap-2 text-sm font-medium text-secondary">
        {t('membershipLabel')}
        <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" name="membershipId" required>
          {memberships.map((membership) => (
            <option key={membership.id} value={membership.id}>
              {membership.associationName}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-secondary">
        {t('typeLabel')}
        <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" name="evidenceType" required>
          <option value="government_id">{t('types.government_id')}</option>
          <option value="immigration_proof">{t('types.immigration_proof')}</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-secondary">
        {t('fileLabel')}
        <input accept="application/pdf,image/jpeg,image/png" className="rounded-sm border border-input bg-card px-3 py-2 text-body" name="evidence" required type="file" />
      </label>
      <p className="text-sm leading-6 text-secondary">{t('help')}</p>
      <SubmitButton />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}
