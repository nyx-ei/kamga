'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createLeveeSchema, type LeveeActionState, updateAssociationLeveeCallStatusSchema } from '@/features/levees/levee-types';
import { requirePlatformAdmin, requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: LeveeActionState = { ok: true };

const createdLeveeSchema = z.object({
  id: z.string().uuid(),
  per_share_amount_cents: z.number(),
  pool_size: z.number().int()
});

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

function leveeErrorCode(message: string): LeveeActionState {
  if (message === 'KMG-AUTH-403' || message === 'KMG-LV-001' || message === 'KMG-LV-002' || message === 'KMG-LV-404') {
    return { ok: false, code: message };
  }

  return { ok: false, code: 'KMG-SYS-000' };
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
