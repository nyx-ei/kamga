'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Mail } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { emailFiscalSlip } from '@/features/fiscal/actions';
import type { FiscalActionState } from '@/features/fiscal/fiscal-types';

type FiscalSlipPanelProps = {
  currentYear: number;
  locale: 'en' | 'fr';
  years: number[];
};

const initialState: FiscalActionState = { ok: true };

function EmailButton() {
  const t = useTranslations('dashboard.fiscalSlips');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-heading shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Mail aria-hidden="true" size={16} />
      {pending ? t('sending') : t('emailAction')}
    </button>
  );
}

export function FiscalSlipPanel({ currentYear, locale, years }: FiscalSlipPanelProps) {
  const t = useTranslations('dashboard.fiscalSlips');
  const [year, setYear] = useState(String(currentYear));
  const [state, action] = useFormState(emailFiscalSlip, initialState);

  return (
    <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-heading">{t('title')}</h2>
        <p className="text-sm leading-6 text-secondary">{t('description')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_auto] md:items-end">
        <label className="grid gap-2 text-sm font-medium text-secondary">
          {t('yearLabel')}
          <select className="rounded-sm border border-input bg-sunken px-3 py-2 text-sm text-body" onChange={(event) => setYear(event.target.value)} value={year}>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-3">
          <a
            className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
            href={`/api/fiscal-slips/${year}/download`}
          >
            <Download aria-hidden="true" size={16} />
            {t('downloadAction')}
          </a>
          <form action={action}>
            <input name="locale" type="hidden" value={locale} />
            <input name="year" type="hidden" value={year} />
            <EmailButton />
          </form>
        </div>
      </div>

      {state.ok && state.sent === true ? <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('emailSent')}</p> : null}
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </section>
  );
}
