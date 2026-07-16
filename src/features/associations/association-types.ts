import { z } from 'zod';

export const ASSOCIATION_STATUSES = ['pending_review', 'active', 'declined', 'suspended'] as const;

export type AssociationStatus = (typeof ASSOCIATION_STATUSES)[number];

export type AssociationActionCode =
  | 'KMG-AUTH-401'
  | 'KMG-AUTH-403'
  | 'KMG-RG-001'
  | 'KMG-RG-002'
  | 'KMG-RG-003'
  | 'KMG-RG-004'
  | 'KMG-RG-404'
  | 'KMG-SYS-000';

export type AssociationActionState =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: AssociationActionCode;
      fieldErrors?: Partial<Record<'name' | 'city' | 'contactEmail' | 'rpnAffiliationProof', AssociationActionCode>>;
    };

export const associationRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  city: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(254),
  locale: z.enum(['en', 'fr'])
});

export const associationDecisionSchema = z.object({
  associationId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});

export const MAX_RPN_PROOF_BYTES = 10 * 1024 * 1024;
export const RPN_PROOF_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type RpnProofMimeType = (typeof RPN_PROOF_MIME_TYPES)[number];
