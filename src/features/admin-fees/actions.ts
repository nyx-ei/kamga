'use server';

import { revalidatePath } from 'next/cache';

import {
  type AdminFeeActionState,
  createAdminFeePayoutSchema,
  updateAssociationAdminFeeSettingsSchema
} from '@/features/admin-fees/admin-fee-types';
import { requirePlatformAdmin } from '@/lib/auth';
import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: AdminFeeActionState = { ok: true };

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function optionalValueFromFormData(formData: FormData, key: string): string | undefined {
  const value = valueFromFormData(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function parseCurrencyCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [dollars = '0', cents = ''] = normalized.split('.');
  const amount = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function adminFeeErrorCode(message: string): AdminFeeActionState {
  if (message === 'KMG-AUTH-403' || message === 'KMG-FEE-001' || message === 'KMG-FEE-404' || message === 'KMG-FEE-STRIPE-CONFIG') {
    return { ok: false, code: message };
  }

  if (message === 'KMG-PAY-STRIPE-CONFIG') {
    return { ok: false, code: 'KMG-FEE-STRIPE-CONFIG' };
  }

  return { ok: false, code: 'KMG-SYS-000' };
}

function revalidateAdminFeePaths(locale: 'en' | 'fr') {
  revalidatePath('/admin/fees');
  revalidatePath(`/${locale}/admin/fees`);
  revalidatePath('/dashboard/contributions');
  revalidatePath(`/${locale}/dashboard/contributions`);
}

export async function updateAssociationAdminFeeSettings(
  _previousState: AdminFeeActionState = INITIAL_ERROR_STATE,
  formData: FormData
): Promise<AdminFeeActionState> {
  await requirePlatformAdmin();

  const feeFixedCents = parseCurrencyCents(valueFromFormData(formData, 'feeFixed'));

  if (feeFixedCents === null) {
    return { ok: false, code: 'KMG-FEE-001' };
  }

  const parsed = updateAssociationAdminFeeSettingsSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    feeBps: Number(valueFromFormData(formData, 'feeBps')),
    feeFixedCents,
    feeModel: valueFromFormData(formData, 'feeModel'),
    isEnabled: formData.get('isEnabled') === 'on',
    locale: valueFromFormData(formData, 'locale'),
    payoutMethod: valueFromFormData(formData, 'payoutMethod'),
    stripeConnectAccountId: optionalValueFromFormData(formData, 'stripeConnectAccountId')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-FEE-001' };
  }

  const { error } = await createSupabaseServerClient().from('association_admin_fee_settings').upsert(
    {
      association_id: parsed.data.associationId,
      fee_bps: parsed.data.feeBps,
      fee_fixed_cents: parsed.data.feeFixedCents,
      fee_model: parsed.data.feeModel,
      is_enabled: parsed.data.isEnabled,
      payout_method: parsed.data.payoutMethod,
      stripe_connect_account_id: parsed.data.stripeConnectAccountId ?? null
    },
    { onConflict: 'association_id' }
  );

  if (error) {
    return adminFeeErrorCode(error.message);
  }

  revalidateAdminFeePaths(parsed.data.locale);
  return { ok: true };
}

export async function createAdminFeePayout(
  _previousState: AdminFeeActionState = INITIAL_ERROR_STATE,
  formData: FormData
): Promise<AdminFeeActionState> {
  const currentUser = await requirePlatformAdmin();
  const parsed = createAdminFeePayoutSchema.safeParse({
    associationAdminUserId: valueFromFormData(formData, 'associationAdminUserId'),
    associationId: valueFromFormData(formData, 'associationId'),
    locale: valueFromFormData(formData, 'locale'),
    method: valueFromFormData(formData, 'method')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-FEE-001' };
  }

  const supabase = createSupabaseServerClient();
  const { data: fees, error: feesError } = await supabase
    .from('association_admin_fees')
    .select('id,fee_amount_cents')
    .eq('association_id', parsed.data.associationId)
    .eq('association_admin_user_id', parsed.data.associationAdminUserId)
    .eq('status', 'accrued');

  if (feesError) {
    return adminFeeErrorCode(feesError.message);
  }

  const feeRows = (fees ?? []).flatMap((row) => {
    const amount = typeof row.fee_amount_cents === 'number' ? row.fee_amount_cents : Number(row.fee_amount_cents);
    return typeof row.id === 'string' && Number.isFinite(amount) ? [{ amount, id: row.id }] : [];
  });
  const amountCents = Math.round(feeRows.reduce((total, fee) => total + fee.amount, 0));

  if (feeRows.length === 0 || amountCents <= 0) {
    return { ok: false, code: 'KMG-FEE-404' };
  }

  const { data: payout, error: payoutError } = await supabase
    .from('association_admin_fee_payouts')
    .insert({
      amount_cents: amountCents,
      association_admin_user_id: parsed.data.associationAdminUserId,
      association_id: parsed.data.associationId,
      created_by: currentUser.user.id,
      method: parsed.data.method,
      paid_at: parsed.data.method === 'manual' ? new Date().toISOString() : null,
      status: parsed.data.method === 'stripe_connect' ? 'processing' : 'paid'
    })
    .select('id')
    .single();

  if (payoutError || payout === null || typeof payout.id !== 'string') {
    return adminFeeErrorCode(payoutError?.message ?? 'KMG-SYS-000');
  }

  let stripeTransferId: string | null = null;

  if (parsed.data.method === 'stripe_connect') {
    const { data: settings, error: settingsError } = await supabase
      .from('association_admin_fee_settings')
      .select('stripe_connect_account_id')
      .eq('association_id', parsed.data.associationId)
      .maybeSingle();

    const destination = typeof settings?.stripe_connect_account_id === 'string' ? settings.stripe_connect_account_id.trim() : '';

    if (settingsError || destination.length === 0) {
      await supabase.from('association_admin_fee_payouts').update({ failure_reason: 'Missing Stripe Connect account', status: 'failed' }).eq('id', payout.id);
      return { ok: false, code: 'KMG-FEE-STRIPE-CONFIG' };
    }

    try {
      const transfer = await createStripeServerClient().transfers.create({
        amount: amountCents,
        currency: 'cad',
        destination,
        metadata: {
          associationAdminUserId: parsed.data.associationAdminUserId,
          associationId: parsed.data.associationId,
          kamgaPayoutId: payout.id
        }
      });

      stripeTransferId = transfer.id;
    } catch (error) {
      await supabase
        .from('association_admin_fee_payouts')
        .update({
          failure_reason: error instanceof Error ? error.message : 'Stripe transfer failed',
          status: 'failed'
        })
        .eq('id', payout.id);

      return adminFeeErrorCode(error instanceof Error ? error.message : 'KMG-SYS-000');
    }
  }

  const { error: updateFeesError } = await supabase
    .from('association_admin_fees')
    .update({
      payout_id: payout.id,
      status: 'paid'
    })
    .in(
      'id',
      feeRows.map((fee) => fee.id)
    );

  if (updateFeesError) {
    return adminFeeErrorCode(updateFeesError.message);
  }

  const { error: updatePayoutError } = await supabase
    .from('association_admin_fee_payouts')
    .update({
      paid_at: new Date().toISOString(),
      status: 'paid',
      stripe_transfer_id: stripeTransferId
    })
    .eq('id', payout.id);

  if (updatePayoutError) {
    return adminFeeErrorCode(updatePayoutError.message);
  }

  revalidateAdminFeePaths(parsed.data.locale);
  return { ok: true, payoutId: payout.id };
}
