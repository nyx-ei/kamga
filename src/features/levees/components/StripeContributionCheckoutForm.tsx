'use client';

import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { startStripeContributionCheckout } from '@/features/levees/actions';
import type { LeveeActionState } from '@/features/levees/levee-types';

type StripeContributionCheckoutFormProps = {
  contributionId: string;
  disabled: boolean;
  locale: 'en' | 'fr';
};

const initialState: LeveeActionState = { ok: true };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations('levees.stripe');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled || pending}
      type="submit"
    >
      <CreditCard aria-hidden="true" size={16} />
      {pending ? t('redirecting') : t('payOnlineAction')}
    </button>
  );
}

export function StripeContributionCheckoutForm({ contributionId, disabled, locale }: StripeContributionCheckoutFormProps) {
  const t = useTranslations('levees.stripe');
  const [state, action] = useFormState(startStripeContributionCheckout, initialState);

  return (
    <form action={action} className="grid gap-3">
      <input name="contributionId" type="hidden" value={contributionId} />
      <input name="locale" type="hidden" value={locale} />
      <SubmitButton disabled={disabled} />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}
