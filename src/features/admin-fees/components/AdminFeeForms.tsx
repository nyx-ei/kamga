'use client';

import { useTranslations } from 'next-intl';
import { Banknote, Save, Send } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { createAdminFeePayout, updateAssociationAdminFeeSettings } from '@/features/admin-fees/actions';
import {
  ADMIN_FEE_MODELS,
  ADMIN_FEE_PAYOUT_METHODS,
  type AdminFeeActionState,
  type AdminFeeModel,
  type AdminFeePayoutMethod
} from '@/features/admin-fees/admin-fee-types';

type AdminFeeSettingsFormProps = {
  associationId: string;
  feeBps: number;
  feeFixedCents: number;
  feeModel: AdminFeeModel;
  isEnabled: boolean;
  locale: 'en' | 'fr';
  payoutMethod: AdminFeePayoutMethod;
  stripeConnectAccountId: string | null;
};

type AdminFeePayoutFormProps = {
  accruedAmountCents: number;
  associationAdminUserId: string;
  associationId: string;
  disabled?: boolean;
  locale: 'en' | 'fr';
  method: AdminFeePayoutMethod;
};

const initialState: AdminFeeActionState = { ok: true };

function SubmitButton({ disabled = false, icon, label, pendingLabel }: { disabled?: boolean; icon: 'payout' | 'save'; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  const Icon = icon === 'payout' ? Banknote : Save;

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending || disabled}
      type="submit"
    >
      <Icon aria-hidden="true" size={16} />
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionError({ state }: { state: AdminFeeActionState }) {
  const t = useTranslations('adminFees.admin');

  if (state.ok) {
    return null;
  }

  return (
    <p className="text-sm font-medium text-negative">
      {t(`errors.${state.code}`)} ({state.code})
    </p>
  );
}

function centsToInputValue(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

export function AdminFeeSettingsForm({
  associationId,
  feeBps,
  feeFixedCents,
  feeModel,
  isEnabled,
  locale,
  payoutMethod,
  stripeConnectAccountId
}: AdminFeeSettingsFormProps) {
  const t = useTranslations('adminFees.admin');
  const [state, action] = useFormState(updateAssociationAdminFeeSettings, initialState);

  return (
    <form action={action} className="grid gap-4 rounded-sm border border-border bg-sunken p-4">
      <input name="associationId" type="hidden" value={associationId} />
      <input name="locale" type="hidden" value={locale} />
      <div className="grid gap-3 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('feeModelLabel')}
          <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={feeModel} name="feeModel">
            {ADMIN_FEE_MODELS.map((model) => (
              <option key={model} value={model}>
                {t(`feeModels.${model}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('feeBpsLabel')}
          <input className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={feeBps} max={10000} min={0} name="feeBps" required type="number" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('feeFixedLabel')}
          <input className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={centsToInputValue(feeFixedCents)} min="0" name="feeFixed" required step="0.01" type="number" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {t('payoutMethodLabel')}
          <select className="rounded-sm border border-input bg-card px-3 py-2 text-body" defaultValue={payoutMethod} name="payoutMethod">
            {ADMIN_FEE_PAYOUT_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`payoutMethods.${method}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-heading">
        {t('stripeConnectAccountLabel')}
        <input
          className="rounded-sm border border-input bg-card px-3 py-2 font-mono text-sm text-body"
          defaultValue={stripeConnectAccountId ?? ''}
          maxLength={120}
          name="stripeConnectAccountId"
          placeholder="acct_..."
        />
      </label>
      <label className="inline-flex items-start gap-3 text-sm font-medium text-heading">
        <input className="mt-1 size-4" defaultChecked={isEnabled} name="isEnabled" type="checkbox" />
        <span>{t('enabledLabel')}</span>
      </label>
      <ActionError state={state} />
      <SubmitButton icon="save" label={t('saveSettingsAction')} pendingLabel={t('saving')} />
    </form>
  );
}

export function AdminFeePayoutForm({ accruedAmountCents, associationAdminUserId, associationId, disabled = false, locale, method }: AdminFeePayoutFormProps) {
  const t = useTranslations('adminFees.admin');
  const [state, action] = useFormState(createAdminFeePayout, initialState);

  return (
    <form action={action} className="grid gap-2">
      <input name="associationAdminUserId" type="hidden" value={associationAdminUserId} />
      <input name="associationId" type="hidden" value={associationId} />
      <input name="locale" type="hidden" value={locale} />
      <input name="method" type="hidden" value={method} />
      <SubmitButton
        disabled={disabled || accruedAmountCents <= 0}
        icon="payout"
        label={method === 'stripe_connect' ? t('stripePayoutAction') : t('manualPayoutAction')}
        pendingLabel={t('paying')}
      />
      <ActionError state={state} />
      {!state.ok ? null : state.payoutId === undefined ? null : (
        <p className="inline-flex w-fit items-center gap-2 rounded-sm bg-positive-bg px-3 py-2 text-sm font-medium text-positive">
          <Send aria-hidden="true" size={15} />
          {t('payoutCreated')}
        </p>
      )}
    </form>
  );
}
