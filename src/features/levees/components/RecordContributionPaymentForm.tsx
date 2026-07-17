'use client';

import { useTranslations } from 'next-intl';
import { ReceiptText } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { recordMemberContributionPayment } from '@/features/levees/actions';
import type { LeveeActionState } from '@/features/levees/levee-types';

type RecordContributionPaymentFormProps = {
  amountPaidCents: number;
  contributionId: string;
  locale: 'en' | 'fr';
};

const initialState: LeveeActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('levees.memberCollection');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <ReceiptText aria-hidden="true" size={15} />
      {pending ? t('recording') : t('recordPaymentAction')}
    </button>
  );
}

function formatInitialAmount(amountPaidCents: number): string {
  return (amountPaidCents / 100).toFixed(2);
}

export function RecordContributionPaymentForm({ amountPaidCents, contributionId, locale }: RecordContributionPaymentFormProps) {
  const t = useTranslations('levees.memberCollection');
  const [state, action] = useFormState(recordMemberContributionPayment, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-sm border border-border bg-sunken p-4">
      <input name="contributionId" type="hidden" value={contributionId} />
      <input name="locale" type="hidden" value={locale} />
      <label className="grid gap-2 text-sm font-medium text-secondary">
        {t('amountPaidLabel')}
        <input
          className="rounded-sm border border-input bg-card px-3 py-2 text-body"
          defaultValue={formatInitialAmount(amountPaidCents)}
          inputMode="decimal"
          name="amountPaid"
          required
          type="text"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-secondary">
        {t('noteLabel')}
        <input className="rounded-sm border border-input bg-card px-3 py-2 text-body" maxLength={500} name="note" type="text" />
      </label>
      <SubmitButton />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}
