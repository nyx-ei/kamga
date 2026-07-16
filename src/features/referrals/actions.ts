'use server';

import { revalidatePath } from 'next/cache';

import { type ReferralActionState, referralCreationSchema, referralSettingsSchema } from '@/features/referrals/referral-types';
import type { Locale } from '@/i18n/routing';
import { getCurrentUser, requirePlatformAdmin } from '@/lib/auth';
import { buildReferralUrl, generateReferralToken } from '@/lib/referrals/tokens';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_STATE: ReferralActionState = { ok: true };

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createReferralToken(
  _previousState: ReferralActionState = INITIAL_STATE,
  formData: FormData
): Promise<ReferralActionState> {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    return { ok: false, code: 'KMG-AUTH-401' };
  }

  const parsed = referralCreationSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-REF-001' };
  }

  const supabase = createSupabaseServerClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateReferralToken();
    const { data, error } = await supabase.rpc('create_referral_token', {
      association_uuid: parsed.data.associationId,
      token_value: token
    });

    if (error === null && data !== null) {
      revalidatePath('/admin/referrals');
      revalidatePath(`/${parsed.data.locale}/admin/referrals`);
      return { ok: true, referralUrl: buildReferralUrl(parsed.data.locale as Locale, token) };
    }

    if (error?.code === '23505') {
      continue;
    }

    if (error?.message === 'KMG-AUTH-403') {
      return { ok: false, code: 'KMG-AUTH-403' };
    }

    if (error?.message === 'KMG-REF-001') {
      return { ok: false, code: 'KMG-REF-001' };
    }

    return { ok: false, code: 'KMG-SYS-000' };
  }

  return { ok: false, code: 'KMG-SYS-000' };
}

export async function updateReferralSettings(
  _previousState: ReferralActionState = INITIAL_STATE,
  formData: FormData
): Promise<ReferralActionState> {
  await requirePlatformAdmin();

  const parsed = referralSettingsSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    allowMemberReferrals: formData.get('allowMemberReferrals') === null ? undefined : 'on',
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-REF-001' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('associations')
    .update({ allow_member_referrals: parsed.data.allowMemberReferrals === 'on' })
    .eq('id', parsed.data.associationId);

  if (error) {
    return { ok: false, code: 'KMG-AUTH-403' };
  }

  revalidatePath('/admin/referrals');
  revalidatePath(`/${parsed.data.locale}/admin/referrals`);

  return { ok: true };
}
