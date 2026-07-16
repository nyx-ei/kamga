'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { memberRegistrationSchema } from '@/features/registration/registration-schema';
import type { MemberEvidenceMimeType, MemberRegistrationActionResult, StoredEvidenceFile, StoredMemberRegistration } from '@/features/registration/registration-types';
import { getCurrentUser } from '@/lib/auth';
import { emailDefaults, resend } from '@/lib/email/resend';
import { env } from '@/lib/env/server-env';
import { parseReferralToken } from '@/lib/referrals/tokens';
import { encryptSin } from '@/lib/security/sin-encryption';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const completedRegistrationSchema = z.object({
  membership_id: z.string().uuid(),
  association_id: z.string().uuid()
});

function evidenceExtension(mimeType: MemberEvidenceMimeType): 'pdf' | 'jpg' | 'png' {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
  }
}

function dataUrlToBuffer(evidence: StoredEvidenceFile): Buffer | null {
  const prefix = `data:${evidence.mimeType};base64,`;

  if (!evidence.dataUrl.startsWith(prefix)) {
    return null;
  }

  return Buffer.from(evidence.dataUrl.slice(prefix.length), 'base64');
}

async function uploadEvidence(membershipId: string, evidence: StoredEvidenceFile, type: 'government_id' | 'immigration_proof') {
  const body = dataUrlToBuffer(evidence);

  if (body === null || body.length === 0) {
    return { ok: false as const };
  }

  const storagePath = `members/${membershipId}/${type}-${Date.now()}.${evidenceExtension(evidence.mimeType)}`;
  const adminSupabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-07: private evidence upload is performed server-side into the private evidence bucket.
  const { error } = await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).upload(storagePath, body, {
    contentType: evidence.mimeType,
    upsert: false
  });

  if (error) {
    return { ok: false as const };
  }

  return { ok: true as const, storagePath };
}

async function removeEvidence(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).remove(paths);
}

function registrationEmailCopy(registration: StoredMemberRegistration): { subject: string; text: string } {
  if (registration.locale === 'fr') {
    return {
      subject: 'Kamga - Demande membre reçue',
      text: 'Votre demande membre a été reçue. Elle est maintenant en attente de revue par l’administrateur de l’association.'
    };
  }

  return {
    subject: 'Kamga - Member application received',
    text: 'Your member application was received. It is now pending review by the association administrator.'
  };
}

async function sendPendingReviewEmail(registration: StoredMemberRegistration) {
  const copy = registrationEmailCopy(registration);
  const { error } = await resend.emails.send({
    from: emailDefaults.from,
    to: registration.email,
    subject: copy.subject,
    text: copy.text
  });

  // Email delivery is non-blocking for registration completion; Resend errors must not expose provider details to the client.
  if (error !== null) {
    return;
  }
}

export async function completeRegistration(registration: unknown): Promise<MemberRegistrationActionResult> {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    return { ok: false, code: 'KMG-AUTH-401' };
  }

  const parsed = memberRegistrationSchema.safeParse(registration);

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const parsedToken = parseReferralToken(parsed.data.referralToken);

  if (!parsedToken.ok) {
    return { ok: false, code: 'KMG-REF-001' };
  }

  const membershipId = crypto.randomUUID();
  const governmentUpload = await uploadEvidence(membershipId, parsed.data.governmentId, 'government_id');

  if (!governmentUpload.ok) {
    return { ok: false, code: 'KMG-RG-004' };
  }

  const immigrationUpload = await uploadEvidence(membershipId, parsed.data.immigrationProof, 'immigration_proof');

  if (!immigrationUpload.ok) {
    await removeEvidence([governmentUpload.storagePath]);
    return { ok: false, code: 'KMG-RG-004' };
  }

  const encryptedSin = encryptSin(parsed.data.sin.replace(/\D/g, ''));
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('complete_referral_member_registration', {
    date_of_arrival_canada_value: parsed.data.dateOfArrivalCanada,
    email_value: parsed.data.email,
    encrypted_sin_hex: encryptedSin.encryptedSinHex,
    first_name_value: parsed.data.firstName,
    government_id_path: governmentUpload.storagePath,
    immigration_proof_path: immigrationUpload.storagePath,
    iv_hex: encryptedSin.ivHex,
    last_name_value: parsed.data.lastName,
    membership_uuid: membershipId,
    phone_value: parsed.data.phone,
    token_value: parsedToken.token
  });

  if (error) {
    await removeEvidence([governmentUpload.storagePath, immigrationUpload.storagePath]);

    if (error.message === 'KMG-AUTH-401') {
      return { ok: false, code: 'KMG-AUTH-401' };
    }

    if (error.message === 'KMG-REF-004') {
      return { ok: false, code: 'KMG-REF-004' };
    }

    return { ok: false, code: 'KMG-SYS-000' };
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  const completedRegistration = completedRegistrationSchema.safeParse(firstRow);

  if (!completedRegistration.success) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  await sendPendingReviewEmail(parsed.data);
  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);

  return { ok: true };
}

