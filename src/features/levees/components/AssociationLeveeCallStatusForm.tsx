'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateAssociationLeveeCallStatus } from '@/features/levees/actions';
import type { AssociationLeveeCallStatus, LeveeActionState } from '@/features/levees/levee-types';

type AssociationLeveeCallStatusFormProps = {
  callId: string;
  currentStatus: AssociationLeveeCallStatus;
  locale: 'en' | 'fr';
};

const initialState: LeveeActionState = { ok: true };
const statuses: AssociationLeveeCallStatus[] = ['pending', 'in_progress', 'completed'];

function SubmitButton() {
  const t = useTranslations('levees.calls');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <RefreshCw aria-hidden="true" size={15} />
      {pending ? t('saving') : t('saveStatusAction')}
    </button>
  );
}

export function AssociationLeveeCallStatusForm({ callId, currentStatus, locale }: AssociationLeveeCallStatusFormProps) {
  const t = useTranslations('levees.calls');
  const [state, action] = useFormState(updateAssociationLeveeCallStatus, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-sm border border-border bg-sunken p-4">
      <input name="callId" type="hidden" value={callId} />
      <input name="locale" type="hidden" value={locale} />
      <label className="grid gap-2 text-sm font-medium text-secondary">
        {t('statusLabel')}
        <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={currentStatus} name="status">
          {statuses.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </select>
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
