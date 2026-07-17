'use server';

import { revalidatePath } from 'next/cache';
import sanitizeHtml from 'sanitize-html';

import {
  declineMemberSchema,
  type MembershipActionState,
  membershipReviewSchema,
  type RequestableEvidenceType,
  requestMoreEvidenceSchema,
  type SINRevealResult,
  sinRevealSchema
} from '@/features/memberships/membership-types';
import { getCurrentUser, requirePlatformAdmin } from '@/lib/auth';
import { decryptSIN } from '@/lib/crypto/sin';
import { emailDefaults, resend } from '@/lib/email/resend';
import { applicationApprovedEmail, applicationDeclinedEmail, moreEvidenceNeededEmail } from '@/lib/email/templates';
import { publicEnv } from '@/lib/env/public-env';
import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: MembershipActionState = { ok: true };

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function valuesFromFormData(formData: FormData, key: string): string[] {
  return formData.getAll(key).flatMap((value) => (typeof value === 'string' ? [value] : []));
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

function sanitizedDeclineReason(html: string): string {
  return sanitizeHtml(html, {
    allowedAttributes: {
      a: ['href', 'rel', 'target']
    },
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a']
  });
}

type ReviewEmailMembership = {
  associationName: string;
  email: string;
};

async function membershipEmailRecipient(membershipId: string): Promise<ReviewEmailMembership | null> {
  const adminSupabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-06: service role shapes the minimal email recipient DTO for an admin-triggered notification.
  const { data, error } = await adminSupabase
    .from('association_members')
    .select('associations:association_id(name),users:user_id(email)')
    .eq('id', membershipId)
    .maybeSingle();

  if (error || data === null) {
    return null;
  }

  const association = Array.isArray(data.associations) ? data.associations[0] : data.associations;
  const user = Array.isArray(data.users) ? data.users[0] : data.users;
  const email = typeof user?.email === 'string' ? user.email : null;
  const associationName = typeof association?.name === 'string' ? association.name : 'Kamga';

  return email === null ? null : { associationName, email };
}

async function sendApprovalEmail(membershipId: string, locale: 'en' | 'fr') {
  const recipient = await membershipEmailRecipient(membershipId);

  if (recipient === null) {
    return;
  }

  const dashboardUrl = new URL(`/${locale}/dashboard`, publicEnv.NEXT_PUBLIC_APP_URL).toString();
  const template = applicationApprovedEmail({ associationName: recipient.associationName, dashboardUrl, locale });

  await resend.emails.send({ from: emailDefaults.from, html: template.html, to: recipient.email, subject: template.subject, text: template.text });
}

async function sendDeclineEmail(membershipId: string, locale: 'en' | 'fr', explanationHtml: string) {
  const recipient = await membershipEmailRecipient(membershipId);

  if (recipient === null) {
    return;
  }

  const template = applicationDeclinedEmail({
    associationName: recipient.associationName,
    declineReasonHtml: explanationHtml,
    locale
  });

  await resend.emails.send({ from: emailDefaults.from, html: template.html, to: recipient.email, subject: template.subject, text: template.text });
}

async function sendMoreEvidenceEmail(membershipId: string, locale: 'en' | 'fr', evidenceTypes: RequestableEvidenceType[]) {
  const recipient = await membershipEmailRecipient(membershipId);

  if (recipient === null) {
    return;
  }

  const uploadUrl = new URL(`/${locale}/dashboard/upload-evidence`, publicEnv.NEXT_PUBLIC_APP_URL).toString();
  const template = moreEvidenceNeededEmail({ associationName: recipient.associationName, evidenceTypes, locale, uploadUrl });

  await resend.emails.send({ from: emailDefaults.from, html: template.html, to: recipient.email, subject: template.subject, text: template.text });
}

async function runTerminalReview(membershipId: string, decision: 'active' | 'declined', locale: 'en' | 'fr', declineReasonHtml: string | null) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('review_member_application', {
    decline_reason_html_value: declineReasonHtml,
    decision_value: decision,
    membership_uuid: membershipId
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

  revalidatePath('/admin/members');
  revalidatePath(`/${locale}/admin/members`);
  revalidatePath(`/${locale}/admin/members/${membershipId}`);
  revalidatePath('/admin/associations');
  revalidatePath(`/${locale}/admin/associations`);

  return { ok: true } satisfies MembershipActionState;
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

  return runTerminalReview(parsed.data.membershipId, parsed.data.decision, parsed.data.locale, null);
}

export async function approveMember(_previousState: MembershipActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<MembershipActionState> {
  await requirePlatformAdmin();

  const parsed = membershipReviewSchema.safeParse({
    decision: 'active',
    locale: valueFromFormData(formData, 'locale'),
    membershipId: valueFromFormData(formData, 'membershipId')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const result = await runTerminalReview(parsed.data.membershipId, 'active', parsed.data.locale, null);

  if (result.ok) {
    await sendApprovalEmail(parsed.data.membershipId, parsed.data.locale);
  }

  return result;
}

export async function declineMember(_previousState: MembershipActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<MembershipActionState> {
  await requirePlatformAdmin();

  const parsed = declineMemberSchema.safeParse({
    declineReasonHtml: valueFromFormData(formData, 'declineReasonHtml'),
    locale: valueFromFormData(formData, 'locale'),
    membershipId: valueFromFormData(formData, 'membershipId')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const explanation = sanitizedDeclineReason(parsed.data.declineReasonHtml);

  if (explanation.trim().length < 10) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const result = await runTerminalReview(parsed.data.membershipId, 'declined', parsed.data.locale, explanation);

  if (result.ok) {
    await sendDeclineEmail(parsed.data.membershipId, parsed.data.locale, explanation);
  }

  return result;
}

export async function requestMoreEvidence(_previousState: MembershipActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<MembershipActionState> {
  await requirePlatformAdmin();

  const parsed = requestMoreEvidenceSchema.safeParse({
    evidenceTypes: valuesFromFormData(formData, 'evidenceTypes'),
    locale: valueFromFormData(formData, 'locale'),
    membershipId: valueFromFormData(formData, 'membershipId')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('association_members')
    .update({
      requested_evidence_types: parsed.data.evidenceTypes,
      reviewed_by: null,
      reviewed_at: null,
      status: 'needs_more_evidence'
    })
    .eq('id', parsed.data.membershipId)
    .in('status', ['pending', 'needs_more_evidence'])
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  if (data === null) {
    return { ok: false, code: 'KMG-RG-409' };
  }

  await sendMoreEvidenceEmail(parsed.data.membershipId, parsed.data.locale, parsed.data.evidenceTypes);
  revalidatePath('/admin/members');
  revalidatePath(`/${parsed.data.locale}/admin/members`);
  revalidatePath(`/${parsed.data.locale}/admin/members/${parsed.data.membershipId}`);

  return { ok: true };
}
