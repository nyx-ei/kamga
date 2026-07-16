import { z } from 'zod';

export const EVIDENCE_TYPES = ['government_id', 'immigration_proof'] as const;
export const EVIDENCE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceMimeType = (typeof EVIDENCE_MIME_TYPES)[number];

export type EvidenceActionCode = 'KMG-AUTH-401' | 'KMG-AUTH-403' | 'KMG-RG-001' | 'KMG-RG-002' | 'KMG-RG-003' | 'KMG-RG-004' | 'KMG-SYS-000';

export type EvidenceActionState =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: EvidenceActionCode;
    };

export const evidenceUploadSchema = z.object({
  evidenceType: z.enum(EVIDENCE_TYPES),
  locale: z.enum(['en', 'fr']),
  membershipId: z.string().uuid()
});
