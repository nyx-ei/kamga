'use client';

import { useTranslations } from 'next-intl';
import { CreditCard, Save } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { startStripeCustomerPortal, updatePaymentPreference } from '@/features/levees/actions';
import type { LeveeActionState, PaymentPreference } from '@/features/levees/levee-types';

type FinancialSettingsFormProps = {
  hasStripeCustomer: boolean;
  locale: 'en' | 'fr';
  paymentPreference: PaymentPreference;
};

const initialState: LeveeActionState = { ok: true };

function PreferenceSubmitButton() {
  const t = useTranslations('dashboard.financialSettings');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Save aria-hidden="true" size={16} />
      {pending ? t('saving') : t('savePreferenceAction')}
    </button>
  );
}

function PortalSubmitButton() {
  const t = useTranslations('dashboard.financialSettings');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-heading shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <CreditCard aria-hidden="true" size={16} />
      {pending ? t('openingPortal') : t('paymentMethodAction')}
    </button>
  );
}

export function FinancialSettingsForm({ hasStripeCustomer, locale, paymentPreference }: FinancialSettingsFormProps) {
  const t = useTranslations('dashboard.financialSettings');
  const [preferenceState, preferenceAction] = useFormState(updatePaymentPreference, initialState);
  const [portalState, portalAction] = useFormState(startStripeCustomerPortal, initialState);

  return (
    <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-heading">{t('title')}</h2>
        <p className="text-sm leading-6 text-secondary">{t('description')}</p>
      </div>

      <form action={preferenceAction} className="grid gap-4">
        <input name="locale" type="hidden" value={locale} />
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-secondary">{t('preferenceLabel')}</legend>
          <label className="flex gap-3 rounded-sm border border-border bg-card p-4 text-sm">
            <input className="mt-1 size-4 accent-brand" defaultChecked={paymentPreference === 'manual'} name="paymentPreference" type="radio" value="manual" />
            <span>
              <span className="block font-medium text-heading">{t('manualTitle')}</span>
              <span className="mt-1 block leading-6 text-secondary">{t('manualDescription')}</span>
            </span>
          </label>
          <label className="flex gap-3 rounded-sm border border-border bg-card p-4 text-sm">
            <input className="mt-1 size-4 accent-brand" defaultChecked={paymentPreference === 'auto_pay'} name="paymentPreference" type="radio" value="auto_pay" />
            <span>
              <span className="block font-medium text-heading">{t('autoPayTitle')}</span>
              <span className="mt-1 block leading-6 text-secondary">{t('autoPayDescription')}</span>
            </span>
          </label>
        </fieldset>
        <PreferenceSubmitButton />
        {preferenceState.ok ? null : (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${preferenceState.code}`)} ({preferenceState.code})
          </p>
        )}
      </form>

      <form action={portalAction} className="grid gap-3 rounded-sm border border-border bg-sunken p-4">
        <input name="locale" type="hidden" value={locale} />
        <div>
          <p className="text-sm font-medium text-heading">{hasStripeCustomer ? t('paymentMethodSaved') : t('paymentMethodMissing')}</p>
          <p className="mt-1 text-sm leading-6 text-secondary">{t('portalDescription')}</p>
        </div>
        <PortalSubmitButton />
        {portalState.ok ? null : (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${portalState.code}`)} ({portalState.code})
          </p>
        )}
      </form>
    </section>
  );
}
