'use client';

import { useTranslations } from 'next-intl';
import { HandCoins } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { createLevee } from '@/features/levees/actions';
import type { LeveeActionState } from '@/features/levees/levee-types';

type LeveeCreateFormProps = {
  locale: 'en' | 'fr';
};

const initialState: LeveeActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('levees.admin');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <HandCoins aria-hidden="true" size={16} />
      {pending ? t('creating') : t('createAction')}
    </button>
  );
}

function formatCents(cents: number | undefined, locale: 'en' | 'fr'): string {
  if (cents === undefined) {
    return '';
  }

  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { currency: 'CAD', style: 'currency' }).format(cents / 100);
}

export function LeveeCreateForm({ locale }: LeveeCreateFormProps) {
  const t = useTranslations('levees.admin');
  const [state, action] = useFormState(createLevee, initialState);

  return (
    <form action={action} className="grid gap-5 rounded-md border border-border bg-sunken p-5">
      <input name="locale" type="hidden" value={locale} />

      {!state.ok ? (
        <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      ) : null}

      {state.ok && state.leveeId !== undefined ? (
        <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">
          {t('createdMessage', { amount: formatCents(state.perShareAmountCents, locale), poolSize: state.poolSize ?? 0 })}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('deceasedFullNameLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition focus:border-focus" maxLength={180} name="deceasedFullName" required type="text" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('deceasedCityLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition focus:border-focus" maxLength={120} name="deceasedCity" type="text" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('deceasedDateOfDeathLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition focus:border-focus" name="deceasedDateOfDeath" type="date" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('deadlineLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition focus:border-focus" name="deadline" required type="date" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-heading md:col-span-2">
          {t('targetAmountLabel')}
          <input
            className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body shadow-card transition focus:border-focus"
            inputMode="decimal"
            name="targetAmount"
            placeholder={t('targetAmountPlaceholder')}
            required
            type="text"
          />
        </label>
      </div>

      <p className="text-sm leading-6 text-secondary">{t('calculationHelp')}</p>
      <SubmitButton />
    </form>
  );
}
