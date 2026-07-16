'use client';

import { useTranslations } from 'next-intl';
import { Save } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateReferralSettings } from '@/features/referrals/actions';
import type { ReferralActionState } from '@/features/referrals/referral-types';

type ReferralSettingsFormProps = {
  allowMemberReferrals: boolean;
  associationId: string;
  locale: 'en' | 'fr';
};

const initialState: ReferralActionState = { ok: true };

function SaveButton() {
  const t = useTranslations('referrals.admin');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Save aria-hidden="true" size={15} />
      {pending ? t('saving') : t('saveSettingsAction')}
    </button>
  );
}

export function ReferralSettingsForm({ allowMemberReferrals, associationId, locale }: ReferralSettingsFormProps) {
  const t = useTranslations('referrals.admin');
  const [state, formAction] = useFormState(updateReferralSettings, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="associationId" type="hidden" value={associationId} />
      <input name="locale" type="hidden" value={locale} />
      <label className="flex items-start gap-3 text-sm text-body">
        <input className="mt-1" defaultChecked={allowMemberReferrals} name="allowMemberReferrals" type="checkbox" />
        <span>{t('allowMemberReferralsLabel')}</span>
      </label>
      {!state.ok ? (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      ) : null}
      <SaveButton />
    </form>
  );
}
