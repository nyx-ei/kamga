'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  closeLeveeIfReadySchema,
  createLeveeSchema,
  type LeveeActionState,
  markAssociationLeveeCallRemittedSchema,
  recordMemberContributionPaymentSchema,
  startStripeContributionCheckoutSchema,
  startStripeCustomerPortalSchema,
  updateAssociationLeveeCallStatusSchema,
  updatePaymentPreferenceSchema} from '@/features/levees/levee-types';
import { requirePlatformAdmin, requireUser } from '@/lib/auth';
import { env } from '@/lib/env/server-env';
import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: LeveeActionState = { ok: true };

const createdLeveeSchema = z.object({
  id: z.string().uuid(),
  per_share_amount_cents: z.number(),
  pool_size: z.number().int()
});

const contributionCheckoutSchema = z.object({
  amount_due_cents: z.number(),
  amount_paid_cents: z.number(),
  association_levee_calls: z
    .object({
      associations: z.union([z.object({ name: z.string() }), z.array(z.object({ name: z.string() }))]).nullable(),
      levees: z
        .object({
          deceased_full_name: z.string()
        })
        .nullable()
    })
    .nullable(),
  association_members: z
    .union([
      z.object({
        user_id: z.string().uuid()
      }),
      z.array(
        z.object({
          user_id: z.string().uuid()
        })
      )
    ])
    .nullable(),
  id: z.string().uuid()
});

const financialSettingsSchema = z
  .object({
    payment_preference: z.enum(['manual', 'auto_pay']),
    stripe_customer_id: z.string().nullable()
  })
  .nullable();

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
  const centsPadded = cents.padEnd(2, '0');
  const amount = Number(dollars) * 100 + Number(centsPadded);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function parseNullableCurrencyCents(value: string): number | null {
  const parsed = parseCurrencyCents(value);

  if (parsed !== null) {
    return parsed;
  }

  return value.trim() === '0' || value.trim() === '0.00' || value.trim() === '0,00' ? 0 : null;
}

function leveeErrorCode(message: string): LeveeActionState {
  if (message === 'KMG-AUTH-403' || message === 'KMG-LV-001' || message === 'KMG-LV-002' || message === 'KMG-LV-003' || message === 'KMG-LV-404') {
    return { ok: false, code: message };
  }

  if (message === 'KMG-PAY-001' || message === 'KMG-PAY-CONFIG' || message === 'KMG-PAY-STRIPE-CONFIG') {
    return { ok: false, code: message === 'KMG-PAY-STRIPE-CONFIG' ? 'KMG-PAY-CONFIG' : message };
  }

  return { ok: false, code: 'KMG-SYS-000' };
}

function contributionAssociationName(contribution: z.infer<typeof contributionCheckoutSchema>): string {
  const association = Array.isArray(contribution.association_levee_calls?.associations)
    ? contribution.association_levee_calls?.associations[0]
    : contribution.association_levee_calls?.associations;
  return association?.name ?? 'Kamga';
}

function contributionOwnerId(contribution: z.infer<typeof contributionCheckoutSchema>): string | null {
  const membership = Array.isArray(contribution.association_members) ? contribution.association_members[0] : contribution.association_members;
  return membership?.user_id ?? null;
}

async function getOrCreateStripeCustomerId(userId: string, email: string | undefined): Promise<string> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from('user_financial_settings').select('payment_preference,stripe_customer_id').eq('user_id', userId).maybeSingle();

  if (error) {
    throw new Error('KMG-SYS-000');
  }

  const parsed = financialSettingsSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error('KMG-SYS-000');
  }

  if (parsed.data?.stripe_customer_id !== null && parsed.data?.stripe_customer_id !== undefined) {
    return parsed.data.stripe_customer_id;
  }

  const stripe = createStripeServerClient();
  const customer = await stripe.customers.create({
    email,
    metadata: {
      kamgaUserId: userId
    }
  });

  const { error: upsertError } = await supabase.from('user_financial_settings').upsert(
    {
      payment_preference: parsed.data?.payment_preference ?? 'manual',
      stripe_customer_id: customer.id,
      user_id: userId
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    throw new Error('KMG-SYS-000');
  }

  return customer.id;
}

export async function createLevee(_previousState: LeveeActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<LeveeActionState> {
  await requirePlatformAdmin();

  const targetAmountCents = parseCurrencyCents(valueFromFormData(formData, 'targetAmount'));

  if (targetAmountCents === null) {
    return { ok: false, code: 'KMG-LV-001' };
  }

  const parsed = createLeveeSchema.safeParse({
    deadline: valueFromFormData(formData, 'deadline'),
    deceasedCity: optionalValueFromFormData(formData, 'deceasedCity'),
    deceasedDateOfDeath: optionalValueFromFormData(formData, 'deceasedDateOfDeath'),
    deceasedFullName: valueFromFormData(formData, 'deceasedFullName'),
    locale: valueFromFormData(formData, 'locale'),
    targetAmountCents
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-LV-001' };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_levee', {
    deadline_value: parsed.data.deadline,
    deceased_city_value: parsed.data.deceasedCity ?? '',
    deceased_date_of_death_value: parsed.data.deceasedDateOfDeath ?? null,
    deceased_full_name_value: parsed.data.deceasedFullName,
    target_amount_cents_value: parsed.data.targetAmountCents
  });

  if (error) {
    return leveeErrorCode(error.message);
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  const created = createdLeveeSchema.safeParse(firstRow);

  if (!created.success) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/admin/levees');
  revalidatePath(`/${parsed.data.locale}/admin/levees`);

  return {
    ok: true,
    leveeId: created.data.id,
    perShareAmountCents: created.data.per_share_amount_cents,
    poolSize: created.data.pool_size
  };
}

export async function updateAssociationLeveeCallStatus(
  _previousState: LeveeActionState = INITIAL_ERROR_STATE,
  formData: FormData
): Promise<LeveeActionState> {
  await requireUser();

  const parsed = updateAssociationLeveeCallStatusSchema.safeParse({
    callId: valueFromFormData(formData, 'callId'),
    locale: valueFromFormData(formData, 'locale'),
    status: valueFromFormData(formData, 'status')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-LV-001' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('update_association_levee_call_status', {
    call_uuid: parsed.data.callId,
    status_value: parsed.data.status
  });

  if (error) {
    return leveeErrorCode(error.message);
  }

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);
  revalidatePath('/admin/levees');
  revalidatePath(`/${parsed.data.locale}/admin/levees`);

  return { ok: true };
}

export async function markAssociationLeveeCallRemitted(_previousState: LeveeActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<LeveeActionState> {
  await requireUser();

  const parsed = markAssociationLeveeCallRemittedSchema.safeParse({
    callId: valueFromFormData(formData, 'callId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-LV-001' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('mark_association_levee_call_remitted', {
    call_uuid: parsed.data.callId
  });

  if (error) {
    return leveeErrorCode(error.message);
  }

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);
  revalidatePath('/admin/levees');
  revalidatePath(`/${parsed.data.locale}/admin/levees`);

  return { ok: true };
}

export async function closeLeveeIfReady(_previousState: LeveeActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<LeveeActionState> {
  await requirePlatformAdmin();

  const parsed = closeLeveeIfReadySchema.safeParse({
    leveeId: valueFromFormData(formData, 'leveeId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-LV-001' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('close_levee_if_ready', {
    levee_uuid: parsed.data.leveeId
  });

  if (error) {
    return leveeErrorCode(error.message);
  }

  revalidatePath('/admin/levees');
  revalidatePath(`/${parsed.data.locale}/admin/levees`);
  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);

  return { ok: true };
}

export async function recordMemberContributionPayment(_previousState: LeveeActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<LeveeActionState> {
  await requireUser();

  const amountPaidCents = parseNullableCurrencyCents(valueFromFormData(formData, 'amountPaid'));

  if (amountPaidCents === null) {
    return { ok: false, code: 'KMG-LV-001' };
  }

  const parsed = recordMemberContributionPaymentSchema.safeParse({
    amountPaidCents,
    contributionId: valueFromFormData(formData, 'contributionId'),
    locale: valueFromFormData(formData, 'locale'),
    note: optionalValueFromFormData(formData, 'note')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-LV-001' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('record_member_contribution_payment', {
    amount_paid_cents_value: parsed.data.amountPaidCents,
    contribution_uuid: parsed.data.contributionId,
    note_value: parsed.data.note ?? ''
  });

  if (error) {
    return leveeErrorCode(error.message);
  }

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);
  revalidatePath('/admin/levees');
  revalidatePath(`/${parsed.data.locale}/admin/levees`);

  return { ok: true };
}

export async function startStripeContributionCheckout(_previousState: LeveeActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<LeveeActionState> {
  const currentUser = await requireUser();
  const parsed = startStripeContributionCheckoutSchema.safeParse({
    contributionId: valueFromFormData(formData, 'contributionId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-PAY-001' };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('member_contributions')
    .select('id,amount_due_cents,amount_paid_cents,association_members:membership_id(user_id),association_levee_calls:association_levee_call_id(associations:association_id(name),levees:levee_id(deceased_full_name))')
    .eq('id', parsed.data.contributionId)
    .maybeSingle();

  if (error || data === null) {
    return { ok: false, code: 'KMG-LV-404' };
  }

  const contribution = contributionCheckoutSchema.safeParse(data);

  if (!contribution.success || contributionOwnerId(contribution.data) !== currentUser.user.id) {
    return { ok: false, code: 'KMG-AUTH-403' };
  }

  const remainingCents = Math.max(0, Math.round(contribution.data.amount_due_cents - contribution.data.amount_paid_cents));

  if (remainingCents <= 0) {
    return { ok: false, code: 'KMG-PAY-001' };
  }

  let checkoutUrl: string;

  try {
    const stripe = createStripeServerClient();
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    const localePrefix = `/${parsed.data.locale}`;
    const customerId = await getOrCreateStripeCustomerId(currentUser.user.id, currentUser.user.email ?? undefined);
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${baseUrl}${localePrefix}/dashboard?payment=cancelled`,
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              description: contributionAssociationName(contribution.data),
              name: contribution.data.association_levee_calls?.levees?.deceased_full_name ?? 'Kamga contribution'
            },
            unit_amount: remainingCents
          },
          quantity: 1
        }
      ],
      metadata: {
        contributionId: contribution.data.id,
        userId: currentUser.user.id
      },
      mode: 'payment',
      payment_intent_data: {
        setup_future_usage: 'off_session'
      },
      success_url: `${baseUrl}${localePrefix}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`
    });

    if (session.url === null) {
      return { ok: false, code: 'KMG-SYS-000' };
    }

    checkoutUrl = session.url;
  } catch (error) {
    return leveeErrorCode(error instanceof Error ? error.message : 'KMG-SYS-000');
  }

  redirect(checkoutUrl);
}

export async function startStripeCustomerPortal(_previousState: LeveeActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<LeveeActionState> {
  const currentUser = await requireUser();
  const parsed = startStripeCustomerPortalSchema.safeParse({
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-PAY-001' };
  }

  let portalUrl: string;

  try {
    const stripe = createStripeServerClient();
    const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    const localePrefix = `/${parsed.data.locale}`;
    const customerId = await getOrCreateStripeCustomerId(currentUser.user.id, currentUser.user.email ?? undefined);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}${localePrefix}/dashboard`
    });

    portalUrl = portal.url;
  } catch (error) {
    return leveeErrorCode(error instanceof Error ? error.message : 'KMG-SYS-000');
  }

  redirect(portalUrl);
}

export async function updatePaymentPreference(_previousState: LeveeActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<LeveeActionState> {
  const currentUser = await requireUser();
  const parsed = updatePaymentPreferenceSchema.safeParse({
    locale: valueFromFormData(formData, 'locale'),
    paymentPreference: valueFromFormData(formData, 'paymentPreference')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-PAY-001' };
  }

  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from('user_financial_settings')
    .select('stripe_customer_id')
    .eq('user_id', currentUser.user.id)
    .maybeSingle();

  if (existingError) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  const { error } = await supabase.from('user_financial_settings').upsert(
    {
      payment_preference: parsed.data.paymentPreference,
      stripe_customer_id: existing?.stripe_customer_id ?? null,
      user_id: currentUser.user.id
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);

  return { ok: true };
}
