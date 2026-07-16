/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import { EVIDENCE_MIME_TYPES, type EvidenceMimeType, type EvidenceType, MAX_EVIDENCE_BYTES } from '@/features/evidence/evidence-types';
import type { StoredEvidenceFile } from '@/features/registration/registration-types';
import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export function evidenceExtension(mimeType: EvidenceMimeType): 'pdf' | 'jpg' | 'png' {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
  }
}

export function evidenceStoragePath(associationId: string, membershipId: string, evidenceType: EvidenceType, mimeType: EvidenceMimeType): string {
  return `${associationId}/${membershipId}/${evidenceType}_${Date.now()}.${evidenceExtension(mimeType)}`;
}

export function dataUrlToEvidenceBuffer(evidence: StoredEvidenceFile): Buffer | null {
  const prefix = `data:${evidence.mimeType};base64,`;

  if (!evidence.dataUrl.startsWith(prefix)) {
    return null;
  }

  return Buffer.from(evidence.dataUrl.slice(prefix.length), 'base64');
}

export function evidenceMimeType(file: File): EvidenceMimeType | null {
  return EVIDENCE_MIME_TYPES.includes(file.type as EvidenceMimeType) ? (file.type as EvidenceMimeType) : null;
}

export async function uploadEvidenceObject(params: {
  associationId: string;
  body: Blob | File;
  evidenceType: EvidenceType;
  membershipId: string;
  mimeType: EvidenceMimeType;
}): Promise<{ ok: true; storagePath: string } | { ok: false }> {
  const storagePath = evidenceStoragePath(params.associationId, params.membershipId, params.evidenceType, params.mimeType);
  const adminSupabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-07: private evidence upload is a trusted server-side storage operation.
  const { error } = await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).upload(storagePath, params.body, {
    contentType: params.mimeType,
    upsert: false
  });

  if (error) {
    return { ok: false };
  }

  return { ok: true, storagePath };
}

export async function removeEvidenceObjects(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).remove(paths);
}

export function isEvidenceFileSizeAllowed(size: number): boolean {
  return size > 0 && size <= MAX_EVIDENCE_BYTES;
}
