'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { EVIDENCE_TYPES, type EvidenceActionState, evidenceUploadSchema } from '@/features/evidence/evidence-types';
import { evidenceMimeType, isEvidenceFileSizeAllowed, removeEvidenceObjects, uploadEvidenceObject } from '@/features/evidence/storage';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: EvidenceActionState = { ok: true };

const membershipRowSchema = evidenceUploadSchema.pick({ membershipId: true }).extend({
  association_id: evidenceUploadSchema.shape.membershipId,
  requested_evidence_types: z.array(z.enum(EVIDENCE_TYPES)).nullable()
});

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function uploadAdditionalEvidence(
  _previousState: EvidenceActionState = INITIAL_ERROR_STATE,
  formData: FormData
): Promise<EvidenceActionState> {
  const currentUser = await requireUser();
  const parsed = evidenceUploadSchema.safeParse({
    evidenceType: valueFromFormData(formData, 'evidenceType'),
    locale: valueFromFormData(formData, 'locale'),
    membershipId: valueFromFormData(formData, 'membershipId')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const file = formData.get('evidence');

  if (!(file instanceof File)) {
    return { ok: false, code: 'KMG-RG-002' };
  }

  if (!isEvidenceFileSizeAllowed(file.size)) {
    return { ok: false, code: 'KMG-RG-003' };
  }

  const mimeType = evidenceMimeType(file);

  if (mimeType === null) {
    return { ok: false, code: 'KMG-RG-004' };
  }

  const supabase = createSupabaseServerClient();
  const { data: membership, error: membershipError } = await supabase
    .from('association_members')
    .select('id,association_id,requested_evidence_types')
    .eq('id', parsed.data.membershipId)
    .eq('user_id', currentUser.user.id)
    .in('status', ['pending', 'needs_more_evidence'])
    .maybeSingle();

  if (membershipError || membership === null) {
    return { ok: false, code: 'KMG-AUTH-403' };
  }

  const parsedMembership = membershipRowSchema.safeParse({
    association_id: membership.association_id,
    membershipId: membership.id,
    requested_evidence_types: membership.requested_evidence_types
  });

  if (!parsedMembership.success) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  const upload = await uploadEvidenceObject({
    associationId: parsedMembership.data.association_id,
    body: file,
    evidenceType: parsed.data.evidenceType,
    membershipId: parsed.data.membershipId,
    mimeType
  });

  if (!upload.ok) {
    return { ok: false, code: 'KMG-RG-004' };
  }

  const { error: insertError } = await supabase.from('evidence_uploads').insert({
    evidence_type: parsed.data.evidenceType,
    membership_id: parsed.data.membershipId,
    status: 'uploaded',
    storage_path: upload.storagePath
  });

  if (insertError) {
    await removeEvidenceObjects([upload.storagePath]);
    return { ok: false, code: 'KMG-SYS-000' };
  }

  const remainingEvidenceTypes = parsedMembership.data.requested_evidence_types?.filter((type) => type !== parsed.data.evidenceType) ?? null;
  const { error: membershipUpdateError } = await supabase
    .from('association_members')
    .update({
      requested_evidence_types: remainingEvidenceTypes !== null && remainingEvidenceTypes.length > 0 ? remainingEvidenceTypes : null,
      status: remainingEvidenceTypes !== null && remainingEvidenceTypes.length > 0 ? 'needs_more_evidence' : 'pending'
    })
    .eq('id', parsed.data.membershipId)
    .eq('user_id', currentUser.user.id);

  if (membershipUpdateError) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);
  revalidatePath('/dashboard/upload-evidence');
  revalidatePath(`/${parsed.data.locale}/dashboard/upload-evidence`);
  revalidatePath('/admin/members');
  revalidatePath(`/${parsed.data.locale}/admin/members`);
  revalidatePath('/admin/associations');
  revalidatePath(`/${parsed.data.locale}/admin/associations`);

  return { ok: true };
}
