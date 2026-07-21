'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash } from 'crypto';

import {
  ASSOCIATION_PRIMARY_LANGUAGES,
  ASSOCIATION_REGISTRY_TYPES,
  type AssociationActionCode,
  type AssociationActionState,
  associationClaimSchema,
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

export async function claimAssociation(_previousState: AssociationActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<AssociationActionState> {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    return { ok: false, code: 'KMG-AUTH-401' };
  }

  const parsed = associationClaimSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    authorized: valueFromFormData(formData, 'authorized'),
    contactEmail: valueFromFormData(formData, 'contactEmail'),
    locale: valueFromFormData(formData, 'locale'),
    registryNumber: valueFromFormData(formData, 'registryNumber')
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      ok: false,
      code: 'KMG-CL-001',
      fieldErrors: {
        authorized: flattened.authorized === undefined ? undefined : 'KMG-CL-001',
        contactEmail: flattened.contactEmail === undefined ? undefined : 'KMG-CL-001',
        registryNumber: flattened.registryNumber === undefined ? undefined : 'KMG-CL-001'
      }
    };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('claim_association', {
    association_uuid: parsed.data.associationId,
    contact_email_value: parsed.data.contactEmail,
    registry_number_value: parsed.data.registryNumber
  });

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  const knownCodes: AssociationActionCode[] = ['KMG-AUTH-401', 'KMG-CL-001', 'KMG-CL-403', 'KMG-CL-404', 'KMG-CL-409', 'KMG-CL-422'];

  if (data !== 'ok') {
    return { ok: false, code: knownCodes.includes(data as AssociationActionCode) ? (data as AssociationActionCode) : 'KMG-SYS-000' };
  }

  revalidatePath('/' + parsed.data.locale + '/associations/' + parsed.data.associationId);
  revalidatePath('/' + parsed.data.locale + '/dashboard/applications');
  redirect('/' + parsed.data.locale + '/dashboard/applications?associationClaimed=1');
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

export type AssociationCsvImportRowResult = {
  rowNumber: number;
  status: 'imported' | 'skipped';
  message: string;
  name?: string;
};

export type AssociationCsvImportState = {
  ok: boolean;
  imported: number;
  skipped: number;
  rows: AssociationCsvImportRowResult[];
};


function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .replace(/^\uFEFF/u, '')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0] ?? '').map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']));
  });
}

export async function importAssociationsCsv(_previousState: AssociationCsvImportState, formData: FormData): Promise<AssociationCsvImportState> {
  await requirePlatformAdmin();

  const file = formData.get('csvFile');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, imported: 0, skipped: 0, rows: [{ rowNumber: 0, status: 'skipped', message: 'KMG-CSV-001' }] };
  }

  if (file.size > 1024 * 1024) {
    return { ok: false, imported: 0, skipped: 0, rows: [{ rowNumber: 0, status: 'skipped', message: 'KMG-CSV-003' }] };
  }

  const rows = parseCsv(await file.text());
  if (rows.length === 0) {
    return { ok: false, imported: 0, skipped: 0, rows: [{ rowNumber: 0, status: 'skipped', message: 'KMG-CSV-001' }] };
  }

  const supabase = createSupabaseAdminClient();
  const results: AssociationCsvImportRowResult[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const officialName = (row.official_name || row.name || '').trim();
    const city = (row.city || '').trim();
    const postalCode = (row.postal_code || row.postalcode || '').trim();
    const primaryLanguage = (row.primary_language || 'fr').trim();
    const registryType = (row.registry_type || '').trim();

    if (officialName.length === 0 || city.length === 0 || postalCode.length === 0) {
      results.push({ rowNumber, status: 'skipped', message: 'KMG-CSV-002', name: officialName || undefined });
      continue;
    }

    if (!ASSOCIATION_PRIMARY_LANGUAGES.includes(primaryLanguage as (typeof ASSOCIATION_PRIMARY_LANGUAGES)[number])) {
      results.push({ rowNumber, status: 'skipped', message: 'KMG-CSV-004', name: officialName });
      continue;
    }

    if (registryType !== '' && !ASSOCIATION_REGISTRY_TYPES.includes(registryType as (typeof ASSOCIATION_REGISTRY_TYPES)[number])) {
      results.push({ rowNumber, status: 'skipped', message: 'KMG-CSV-004', name: officialName });
      continue;
    }

    const registryNumber = optionalValue(row.registry_number || '');
    if (registryNumber !== null) {
      const { data: duplicate } = await supabase.from('associations').select('id').eq('registry_number', registryNumber).limit(1).maybeSingle();
      if (duplicate !== null) {
        results.push({ rowNumber, status: 'skipped', message: 'KMG-CSV-409', name: officialName });
        continue;
      }
    }

    const displayName = optionalValue(row.common_name || '') ?? officialName;
    const { error } = await supabase.from('associations').insert({
      aliases: [],
      city,
      claim_status: 'unclaimed',
      common_name: displayName,
      contact_email: optionalValue(row.contact_email || ''),
      contact_notification_opt_in_status: optionalValue(row.contact_email || '') === null ? 'withdrawn' : 'pending',
      description: optionalValue(row.description || ''),
      geocode_status: 'pending',
      name: displayName,
      official_name: officialName,
      postal_code: postalCode,
      primary_language: primaryLanguage,
      province: optionalValue(row.province || '')?.toUpperCase() ?? 'QC',
      public_precision: 'neighbourhood',
      registry_number: registryNumber,
      registry_type: optionalValue(registryType),
      source: 'csv_import',
      status: 'active',
      verification_status: registryNumber === null ? 'unverified' : 'needs_review'
    });

    results.push({ rowNumber, status: error === null ? 'imported' : 'skipped', message: error === null ? 'KMG-CSV-OK' : 'KMG-SYS-000', name: officialName });
  }

  revalidatePath('/en/admin/csv');
  revalidatePath('/fr/admin/csv');
  revalidatePath('/en');
  revalidatePath('/fr');

  const imported = results.filter((row) => row.status === 'imported').length;
  const skipped = results.length - imported;
  return { ok: skipped === 0, imported, skipped, rows: results };
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


