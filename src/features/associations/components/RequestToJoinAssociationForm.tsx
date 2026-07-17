'use client';

import { useTranslations } from 'next-intl';
import { UserPlus } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { requestToJoinAssociation } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

type RequestToJoinAssociationFormProps = {
  associationId: string;
  locale: 'en' | 'fr';
};

const initialState: AssociationActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('associations.join');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <UserPlus aria-hidden="true" size={16} />
      {pending ? t('submitting') : t('action')}
    </button>
  );
}

export function RequestToJoinAssociationForm({ associationId, locale }: RequestToJoinAssociationFormProps) {
  const t = useTranslations('associations.join');
  const [state, action] = useFormState(requestToJoinAssociation, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-md border border-border bg-sunken p-5">
      <input name="associationId" type="hidden" value={associationId} />
      <input name="locale" type="hidden" value={locale} />
      <p className="text-sm leading-6 text-secondary">{t('description')}</p>
      <SubmitButton />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}
