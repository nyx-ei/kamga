'use client';

import { useTranslations } from 'next-intl';
import { LockKeyhole } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { closeLeveeIfReady } from '@/features/levees/actions';
import type { LeveeActionState } from '@/features/levees/levee-types';

type CloseLeveeFormProps = {
  disabled: boolean;
  leveeId: string;
  locale: 'en' | 'fr';
};

const initialState: LeveeActionState = { ok: true };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations('levees.closure');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled || pending}
      type="submit"
    >
      <LockKeyhole aria-hidden="true" size={15} />
      {pending ? t('closing') : t('closeAction')}
    </button>
  );
}

export function CloseLeveeForm({ disabled, leveeId, locale }: CloseLeveeFormProps) {
  const t = useTranslations('levees.closure');
  const [state, action] = useFormState(closeLeveeIfReady, initialState);

  return (
    <form action={action} className="grid gap-2">
      <input name="leveeId" type="hidden" value={leveeId} />
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
