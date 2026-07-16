'use client';

import { useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { createReferralToken } from '@/features/referrals/actions';
import type { ReferralActionState } from '@/features/referrals/referral-types';

type AssociationOption = {
  id: string;
  name: string;
};

type ReferralGeneratorFormProps = {
  associations: AssociationOption[];
  locale: 'en' | 'fr';
};

const initialState: ReferralActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('referrals.admin');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Link2 aria-hidden="true" size={16} />
      {pending ? t('generating') : t('generateAction')}
    </button>
  );
}

export function ReferralGeneratorForm({ associations, locale }: ReferralGeneratorFormProps) {
  const t = useTranslations('referrals.admin');
  const [state, formAction] = useFormState(createReferralToken, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-border bg-sunken p-5">
      <input name="locale" type="hidden" value={locale} />
      <div className="grid gap-2">
        <label className="text-sm font-medium text-heading" htmlFor="referral-association">
          {t('associationLabel')}
        </label>
        <select
          className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition focus:border-focus"
          id="referral-association"
          name="associationId"
          required
        >
          {associations.map((association) => (
            <option key={association.id} value={association.id}>
              {association.name}
            </option>
          ))}
        </select>
      </div>

      {!state.ok ? (
        <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      ) : null}

      {state.ok && state.referralUrl !== undefined ? (
        <p className="break-all rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">
          {state.referralUrl}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
