'use client';

import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { uploadAdditionalEvidence } from '@/features/evidence/actions';
import type { EvidenceActionState, EvidenceType } from '@/features/evidence/evidence-types';

type UploadMoreEvidenceFormProps = {
  locale: 'en' | 'fr';
  memberships: Array<{
    associationName: string;
    id: string;
    requestedEvidenceTypes: EvidenceType[];
  }>;
};

type EvidenceUploadCardProps = {
  associationName: string;
  evidenceType: EvidenceType;
  locale: 'en' | 'fr';
  membershipId: string;
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

function EvidenceUploadCard({ associationName, evidenceType, locale, membershipId }: EvidenceUploadCardProps) {
  const t = useTranslations('evidence.upload');
  const [state, action] = useFormState(uploadAdditionalEvidence, initialState);

  return (
    <form action={action} className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
      <input name="locale" type="hidden" value={locale} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <input name="evidenceType" type="hidden" value={evidenceType} />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted">{associationName}</p>
        <h2 className="text-xl font-semibold text-heading">{t(`types.${evidenceType}`)}</h2>
      </div>
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

export function UploadMoreEvidenceForm({ locale, memberships }: UploadMoreEvidenceFormProps) {
  return (
    <div className="grid gap-4">
      {memberships.flatMap((membership) =>
        membership.requestedEvidenceTypes.map((evidenceType) => (
          <EvidenceUploadCard
            associationName={membership.associationName}
            evidenceType={evidenceType}
            key={`${membership.id}-${evidenceType}`}
            locale={locale}
            membershipId={membership.id}
          />
        ))
      )}
    </div>
  );
}
