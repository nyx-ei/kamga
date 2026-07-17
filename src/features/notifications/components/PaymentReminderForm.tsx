'use client';

import { useTranslations } from 'next-intl';
import { BellRing } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { sendPaymentReminder } from '@/features/notifications/actions';
import type { NotificationActionState } from '@/features/notifications/notification-types';

type PaymentReminderFormProps = {
  contributionId: string;
  disabled: boolean;
  locale: 'en' | 'fr';
};

const initialState: NotificationActionState = { ok: true };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations('notifications');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-heading shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled || pending}
      type="submit"
    >
      <BellRing aria-hidden="true" size={16} />
      {pending ? t('sendingReminder') : t('sendReminderAction')}
    </button>
  );
}

export function PaymentReminderForm({ contributionId, disabled, locale }: PaymentReminderFormProps) {
  const t = useTranslations('notifications');
  const [state, action] = useFormState(sendPaymentReminder, initialState);

  return (
    <form action={action} className="grid gap-2">
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
