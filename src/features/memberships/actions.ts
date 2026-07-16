'use server';

import { revalidatePath } from 'next/cache';

import { type MembershipActionState, membershipReviewSchema, type SINRevealResult, sinRevealSchema } from '@/features/memberships/membership-types';
import { getCurrentUser, requirePlatformAdmin } from '@/lib/auth';
import { decryptSIN } from '@/lib/crypto/sin';
import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: MembershipActionState = { ok: true };

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function byteaToBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (typeof value === 'string') {
    const hex = value.startsWith('\\x') ? value.slice(2) : value;
    return /^[\da-f]+$/i.test(hex) ? Buffer.from(hex, 'hex') : null;
  }

  return null;
}

function membershipErrorCode(message: string): MembershipActionState {
  if (message === 'KMG-AUTH-403' || message === 'KMG-RG-001' || message === 'KMG-RG-404' || message === 'KMG-RG-409') {
    return { ok: false, code: message };
  }

  return { ok: false, code: 'KMG-SYS-000' };
}

export async function revealSIN(membershipId: string): Promise<SINRevealResult> {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== 'platform_admin') {
    return { ok: false, code: 'KMG-AUTH-403' };
  }

  const parsed = sinRevealSchema.safeParse({ membershipId });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const adminSupabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-04: service role is required because sin_tokens has no client RLS policy.
  const { data, error } = await adminSupabase
    .from('sin_tokens')
    .select('encrypted_sin,iv,membership_id')
    .eq('membership_id', parsed.data.membershipId)
    .maybeSingle();

  if (error || data === null) {
    return { ok: false, code: 'KMG-RG-404' };
  }

  const encrypted = byteaToBuffer(data.encrypted_sin);
  const iv = byteaToBuffer(data.iv);

  if (encrypted === null || iv === null) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  // CV-SEC-10: audit the reveal without logging or persisting the plaintext SIN.
  const { error: auditError } = await adminSupabase.from('sin_reveal_audit_logs').insert({
    membership_id: parsed.data.membershipId,
    revealed_by: currentUser.user.id
  });

  if (auditError) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  try {
    return { ok: true, sin: decryptSIN(encrypted, iv) };
  } catch {
    return { ok: false, code: 'KMG-SYS-000' };
  }
}

export async function reviewMembership(
  _previousState: MembershipActionState = INITIAL_ERROR_STATE,
  formData: FormData
): Promise<MembershipActionState> {
  await requirePlatformAdmin();

  const parsed = membershipReviewSchema.safeParse({
    decision: valueFromFormData(formData, 'decision'),
    locale: valueFromFormData(formData, 'locale'),
    membershipId: valueFromFormData(formData, 'membershipId')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('review_member_application', {
    decline_reason_html_value: null,
    decision_value: parsed.data.decision,
    membership_uuid: parsed.data.membershipId
  });

  if (error) {
    return membershipErrorCode(error.message);
  }

  const storagePaths = Array.isArray(data)
    ? data.flatMap((row: { destroyed_storage_path?: unknown }) => (typeof row.destroyed_storage_path === 'string' ? [row.destroyed_storage_path] : []))
    : [];

  if (storagePaths.length > 0) {
    const adminSupabase = createSupabaseAdminClient();
    // CV-DB-04 / CV-SEC-07: terminal review destroys private evidence objects after DB state is terminal.
    await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).remove(storagePaths);
  }

  revalidatePath('/admin/associations');
  revalidatePath(`/${parsed.data.locale}/admin/associations`);

  return { ok: true };
}
