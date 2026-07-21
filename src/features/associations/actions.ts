'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash } from 'crypto';

import {
  type AssociationActionState,
  associationConnectRequestSchema,
  associationDecisionSchema,
  associationJoinRequestSchema,
  associationRegistrationSchema,
  MAX_RPN_PROOF_BYTES,
  RPN_PROOF_MIME_TYPES,
  type RpnProofMimeType
} from '@/features/associations/association-types';
import { getCurrentUser, requirePlatformAdmin } from '@/lib/auth';
import { env } from '@/lib/env/server-env';
import { notifyJoinRequestSubmitted } from '@/lib/notifications/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_ERROR_STATE: AssociationActionState = { ok: true };
type AssociationActionFailure = Exclude<AssociationActionState, { ok: true }>;

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function optionalValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function parseRpnProof(formData: FormData): { valid: true; file: File; extension: string } | { valid: true; file: null; extension: null } | AssociationActionFailure {
  const proof = formData.get('rpnAffiliationProof');

  if (!(proof instanceof File) || proof.size === 0) {
    return { valid: true, file: null, extension: null };
  }

  if (proof.size > MAX_RPN_PROOF_BYTES) {
    return { ok: false, code: 'KMG-RG-003', fieldErrors: { rpnAffiliationProof: 'KMG-RG-003' } };
  }

  if (!RPN_PROOF_MIME_TYPES.includes(proof.type as RpnProofMimeType)) {
    return { ok: false, code: 'KMG-RG-004', fieldErrors: { rpnAffiliationProof: 'KMG-RG-004' } };
  }

  return { valid: true, file: proof, extension: mimeExtension(proof.type as RpnProofMimeType) };
}

function hashSensitiveRateLimitValue(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function requesterIpHash(): string | null {
  const headerList = headers();
  const forwardedFor = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headerList.get('x-real-ip')?.trim();
  const ip = forwardedFor !== undefined && forwardedFor.length > 0 ? forwardedFor : realIp;

  return ip === undefined || ip.length === 0 ? null : hashSensitiveRateLimitValue(ip);
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
    city: valueFromFormData(formData, 'city'),
    commonName: valueFromFormData(formData, 'commonName'),
    contactEmail: valueFromFormData(formData, 'contactEmail'),
    locale: valueFromFormData(formData, 'locale'),
    name: valueFromFormData(formData, 'name'),
    postalCode: valueFromFormData(formData, 'postalCode'),
    primaryLanguage: valueFromFormData(formData, 'primaryLanguage'),
    province: valueFromFormData(formData, 'province') || 'QC',
    registryNumber: valueFromFormData(formData, 'registryNumber'),
    registryType: valueFromFormData(formData, 'registryType'),
    streetAddress: valueFromFormData(formData, 'streetAddress')
  });

  if (!parsedFields.success) {
    const flattened = parsedFields.error.flatten().fieldErrors;

    return {
      ok: false,
      code: 'KMG-RG-001',
      fieldErrors: {
        city: flattened.city === undefined ? undefined : 'KMG-RG-001',
        contactEmail: flattened.contactEmail === undefined ? undefined : 'KMG-RG-001',
        name: flattened.name === undefined ? undefined : 'KMG-RG-001',
        postalCode: flattened.postalCode === undefined ? undefined : 'KMG-RG-001',
        primaryLanguage: flattened.primaryLanguage === undefined ? undefined : 'KMG-RG-001',
        registryNumber: flattened.registryNumber === undefined ? undefined : 'KMG-RG-001',
        streetAddress: flattened.streetAddress === undefined ? undefined : 'KMG-RG-001'
      }
    };
  }

  const parsedProof = parseRpnProof(formData);

  if (!('valid' in parsedProof)) {
    return parsedProof;
  }

  const associationId = crypto.randomUUID();
  const storagePath = parsedProof.file === null ? null : `associations/${associationId}/rpn-affiliation-proof-${Date.now()}.${parsedProof.extension}`;

  const supabase = createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();

  if (parsedProof.file !== null && storagePath !== null) {
    // CV-DB-04 / CV-SEC-07: private evidence upload is a trusted server-side storage operation.
    const { error: uploadError } = await adminSupabase.storage
      .from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET)
      .upload(storagePath, parsedProof.file, { contentType: parsedProof.file.type, upsert: false });

    if (uploadError) {
      return { ok: false, code: 'KMG-SYS-000' };
    }
  }

  const displayName = optionalValue(parsedFields.data.commonName ?? '') ?? parsedFields.data.name;
  const registryNumber = optionalValue(parsedFields.data.registryNumber ?? '');
  const registryType = optionalValue(parsedFields.data.registryType ?? '');
  const contactEmail = optionalValue(parsedFields.data.contactEmail ?? '');

  const { error: insertError } = await supabase.from('associations').insert({
    id: associationId,
    aliases: [],
    city: parsedFields.data.city,
    claim_status: 'claimed',
    common_name: displayName,
    contact_email: contactEmail,
    contact_notification_opt_in_status: contactEmail === null ? 'withdrawn' : 'pending',
    geocode_status: 'pending',
    name: displayName,
    official_name: parsedFields.data.name,
    postal_code: parsedFields.data.postalCode,
    primary_language: parsedFields.data.primaryLanguage,
    province: parsedFields.data.province.toUpperCase(),
    public_precision: 'neighbourhood',
    registry_number: registryNumber,
    registry_type: registryType,
    rpn_affiliation_proof_path: storagePath,
    source: 'self_registered',
    status: 'pending_review',
    street_address: optionalValue(parsedFields.data.streetAddress ?? ''),
    verification_status: registryNumber === null ? 'unverified' : 'needs_review',
    created_by: currentUser.user.id
  });

  if (insertError) {
    if (storagePath !== null) {
      await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).remove([storagePath]);
    }
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/admin/associations');
  revalidatePath('/dashboard');
  redirect(`/${parsedFields.data.locale}/dashboard/applications?associationSubmitted=1`);
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

export async function submitAssociationConnectRequest(_previousState: AssociationActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<AssociationActionState> {
  const parsed = associationConnectRequestSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    locale: valueFromFormData(formData, 'locale'),
    message: valueFromFormData(formData, 'message'),
    requesterEmail: valueFromFormData(formData, 'requesterEmail'),
    requesterName: valueFromFormData(formData, 'requesterName'),
    requesterPhone: valueFromFormData(formData, 'requesterPhone')
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      ok: false,
      code: 'KMG-RC-001',
      fieldErrors: {
        message: flattened.message === undefined ? undefined : 'KMG-RC-001',
        requesterEmail: flattened.requesterEmail === undefined ? undefined : 'KMG-RC-001',
        requesterName: flattened.requesterName === undefined ? undefined : 'KMG-RC-001',
        requesterPhone: flattened.requesterPhone === undefined ? undefined : 'KMG-RC-001'
      }
    };
  }

  const replyChannel = parsed.data.requesterEmail !== '' ? parsed.data.requesterEmail : parsed.data.requesterPhone;
  // Anonymous public requests are inserted through a SECURITY DEFINER RPC that owns validation and rate limits.
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('submit_association_connect_request', {
    association_uuid: parsed.data.associationId,
    locale_value: parsed.data.locale,
    message_value: parsed.data.message,
    reply_channel_hash_value: hashSensitiveRateLimitValue(replyChannel ?? ''),
    requester_email_value: optionalValue(parsed.data.requesterEmail ?? ''),
    requester_ip_hash_value: requesterIpHash(),
    requester_name_value: parsed.data.requesterName,
    requester_phone_value: optionalValue(parsed.data.requesterPhone ?? '')
  });

  if (error) {
    if (error.message === 'KMG-RC-404') {
      return { ok: false, code: 'KMG-RC-404' };
    }

    if (error.message === 'KMG-RC-429') {
      return { ok: false, code: 'KMG-RC-429' };
    }

    return { ok: false, code: error.message === 'KMG-RC-001' ? 'KMG-RC-001' : 'KMG-SYS-000' };
  }

  revalidatePath(`/${parsed.data.locale}/associations/${parsed.data.associationId}`);
  return { ok: true, submitted: true };
}

export async function requestToJoinAssociation(_previousState: AssociationActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<AssociationActionState> {
  const currentUser = await getCurrentUser();
  const parsed = associationJoinRequestSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-RG-001' };
  }

  if (currentUser === null) {
    redirect(`/${parsed.data.locale}/auth/login?next=/${parsed.data.locale}/associations/${parsed.data.associationId}`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('request_to_join_association', {
    association_uuid: parsed.data.associationId
  });

  if (error) {
    if (error.message === 'KMG-RG-404') {
      return { ok: false, code: 'KMG-RG-404' };
    }

    return { ok: false, code: 'KMG-SYS-000' };
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: association } = await adminSupabase.from('associations').select('name').eq('id', parsed.data.associationId).maybeSingle();
  const applicantName = currentUser.user.email ?? currentUser.user.id;
  await notifyJoinRequestSubmitted({
    applicantName,
    associationId: parsed.data.associationId,
    associationName: typeof association?.name === 'string' ? association.name : 'Kamga',
    locale: parsed.data.locale
  });

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);
  revalidatePath(`/${parsed.data.locale}/associations/${parsed.data.associationId}`);
  redirect(`/${parsed.data.locale}/dashboard/applications?joinRequest=1`);
}


