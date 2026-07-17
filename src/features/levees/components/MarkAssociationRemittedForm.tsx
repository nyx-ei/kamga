'use client';

import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { markAssociationLeveeCallRemitted } from '@/features/levees/actions';
import type { LeveeActionState } from '@/features/levees/levee-types';

type MarkAssociationRemittedFormProps = {
  callId: string;
  disabled: boolean;
  locale: 'en' | 'fr';
};

const initialState: LeveeActionState = { ok: true };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations('levees.remittance');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled || pending}
      type="submit"
    >
      <Send aria-hidden="true" size={15} />
      {pending ? t('marking') : t('markRemittedAction')}
    </button>
  );
}

export function MarkAssociationRemittedForm({ callId, disabled, locale }: MarkAssociationRemittedFormProps) {
  const t = useTranslations('levees.remittance');
  const [state, action] = useFormState(markAssociationLeveeCallRemitted, initialState);

  return (
    <form action={action} className="grid gap-2">
      <input name="callId" type="hidden" value={callId} />
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
