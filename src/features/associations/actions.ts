'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  type AssociationActionState,
  associationDecisionSchema,
  associationRegistrationSchema,
  MAX_RPN_PROOF_BYTES,
  RPN_PROOF_MIME_TYPES,
  type RpnProofMimeType
} from '@/features/associations/association-types';
import { getCurrentUser, requirePlatformAdmin } from '@/lib/auth';
import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: AssociationActionState = { ok: true };
type AssociationActionFailure = Exclude<AssociationActionState, { ok: true }>;

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function mimeExtension(mimeType: RpnProofMimeType): 'pdf' | 'jpg' | 'png' {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
  }
}

function parseRpnProof(formData: FormData): { valid: true; file: File; extension: string } | AssociationActionFailure {
  const proof = formData.get('rpnAffiliationProof');

  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, code: 'KMG-RG-002', fieldErrors: { rpnAffiliationProof: 'KMG-RG-002' } };
  }

  if (proof.size > MAX_RPN_PROOF_BYTES) {
    return { ok: false, code: 'KMG-RG-003', fieldErrors: { rpnAffiliationProof: 'KMG-RG-003' } };
  }

  if (!RPN_PROOF_MIME_TYPES.includes(proof.type as RpnProofMimeType)) {
    return { ok: false, code: 'KMG-RG-004', fieldErrors: { rpnAffiliationProof: 'KMG-RG-004' } };
  }

  return { valid: true, file: proof, extension: mimeExtension(proof.type as RpnProofMimeType) };
}

export async function registerAssociation(
  _previousState: AssociationActionState = INITIAL_ERROR_STATE,
  formData: FormData
): Promise<AssociationActionState> {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    return { ok: false, code: 'KMG-AUTH-401' };
  }

  const parsedFields = associationRegistrationSchema.safeParse({
    name: valueFromFormData(formData, 'name'),
    city: valueFromFormData(formData, 'city'),
    contactEmail: valueFromFormData(formData, 'contactEmail'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsedFields.success) {
    const flattened = parsedFields.error.flatten().fieldErrors;

    return {
      ok: false,
      code: 'KMG-RG-001',
      fieldErrors: {
        name: flattened.name === undefined ? undefined : 'KMG-RG-001',
        city: flattened.city === undefined ? undefined : 'KMG-RG-001',
        contactEmail: flattened.contactEmail === undefined ? undefined : 'KMG-RG-001'
      }
    };
  }

  const parsedProof = parseRpnProof(formData);

  if (!('valid' in parsedProof)) {
    return parsedProof;
  }

  const associationId = crypto.randomUUID();
  const storagePath = `associations/${associationId}/rpn-affiliation-proof-${Date.now()}.${parsedProof.extension}`;

  const supabase = createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();

  // CV-DB-04 / CV-SEC-07: private evidence upload is a trusted server-side storage operation.
  const { error: uploadError } = await adminSupabase.storage
    .from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET)
    .upload(storagePath, parsedProof.file, { contentType: parsedProof.file.type, upsert: false });

  if (uploadError) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  const { error: insertError } = await supabase.from('associations').insert({
    id: associationId,
    name: parsedFields.data.name,
    city: parsedFields.data.city,
    contact_email: parsedFields.data.contactEmail,
    status: 'pending_review',
    created_by: currentUser.user.id,
    rpn_affiliation_proof_path: storagePath
  });

  if (insertError) {
    await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).remove([storagePath]);
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/admin/associations');
  revalidatePath('/dashboard');
  redirect(`/${parsedFields.data.locale}/dashboard?associationSubmitted=1`);
}

async function runAssociationDecision(
  formData: FormData,
  rpcName: 'approve_association' | 'suspend_association'
): Promise<AssociationActionState> {
  await requirePlatformAdmin();

  const parsed = associationDecisionSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc(rpcName, { association_uuid: parsed.data.associationId });

  if (error) {
    return { ok: false, code: error.message === 'KMG-RG-404' ? 'KMG-RG-404' : 'KMG-SYS-000' };
  }

  revalidatePath('/admin/associations');
  revalidatePath(`/${parsed.data.locale}/admin/associations`);
  revalidatePath(`/${parsed.data.locale}/associations/${parsed.data.associationId}`);

  return { ok: true };
}

export async function approveAssociation(_previousState: AssociationActionState, formData: FormData): Promise<AssociationActionState> {
  return runAssociationDecision(formData, 'approve_association');
}

export async function suspendAssociation(_previousState: AssociationActionState, formData: FormData): Promise<AssociationActionState> {
  return runAssociationDecision(formData, 'suspend_association');
}




