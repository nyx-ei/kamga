import { z } from 'zod';

export const ASSOCIATION_STATUSES = ['pending_review', 'active', 'declined', 'suspended'] as const;
export const ASSOCIATION_PRIMARY_LANGUAGES = ['fr', 'en', 'fr_en'] as const;
export const ASSOCIATION_PUBLIC_PRECISIONS = ['neighbourhood', 'exact'] as const;
export const ASSOCIATION_VERIFICATION_STATUSES = ['unverified', 'verified', 'needs_review'] as const;
export const ASSOCIATION_CLAIM_STATUSES = ['unclaimed', 'claimed', 'claim_pending', 'claim_locked'] as const;
export const ASSOCIATION_REGISTRY_TYPES = ['neq', 'federal'] as const;

export type AssociationStatus = (typeof ASSOCIATION_STATUSES)[number];
export type AssociationPrimaryLanguage = (typeof ASSOCIATION_PRIMARY_LANGUAGES)[number];
export type AssociationVerificationStatus = (typeof ASSOCIATION_VERIFICATION_STATUSES)[number];
export type AssociationClaimStatus = (typeof ASSOCIATION_CLAIM_STATUSES)[number];

export type AssociationActionCode =
  | 'KMG-AUTH-401'
  | 'KMG-AUTH-403'
  | 'KMG-RC-001'
  | 'KMG-RC-404'
  | 'KMG-RC-429'
  | 'KMG-CL-001'
  | 'KMG-CL-403'
  | 'KMG-CL-404'
  | 'KMG-CL-409'
  | 'KMG-CL-422'
  | 'KMG-RG-001'
  | 'KMG-RG-002'
  | 'KMG-RG-003'
  | 'KMG-RG-004'
  | 'KMG-RG-404'
  | 'KMG-RG-409'
  | 'KMG-SYS-000';

export type AssociationActionState =
  | {
      ok: true;
      submitted?: boolean;
    }
  | {
      ok: false;
      code: AssociationActionCode;
      fieldErrors?: Partial<
        Record<
          | 'authorized'
          | 'city'
          | 'commonName'
          | 'contactEmail'
          | 'message'
          | 'name'
          | 'officialName'
          | 'phone'
          | 'postalCode'
          | 'primaryLanguage'
          | 'registryNumber'
          | 'replyChannel'
          | 'requesterEmail'
          | 'requesterName'
          | 'requesterPhone'
          | 'rpnAffiliationProof'
          | 'streetAddress',
          AssociationActionCode
        >
      >;
    };

const optionalTrimmedString = z.string().trim().max(180).optional().or(z.literal(''));

export const associationRegistrationSchema = z.object({
  city: z.string().trim().min(2).max(120),
  commonName: optionalTrimmedString,
  contactEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  locale: z.enum(['en', 'fr']),
  name: z.string().trim().min(2).max(180),
  postalCode: z.string().trim().min(3).max(12),
  primaryLanguage: z.enum(ASSOCIATION_PRIMARY_LANGUAGES),
  province: z.string().trim().length(2).default('QC'),
  registryNumber: z.string().trim().max(64).optional().or(z.literal('')),
  registryType: z.enum(ASSOCIATION_REGISTRY_TYPES).optional().or(z.literal('')),
  streetAddress: z.string().trim().max(220).optional().or(z.literal(''))
});


export const associationRecordUpdateSchema = z.object({
  associationId: z.string().uuid(),
  city: z.string().trim().min(2).max(120),
  commonName: optionalTrimmedString,
  contactEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  description: z.string().trim().max(1200).optional().or(z.literal('')),
  locale: z.enum(['en', 'fr']),
  officialName: z.string().trim().min(2).max(180),
  postalCode: z.string().trim().min(3).max(12),
  primaryLanguage: z.enum(ASSOCIATION_PRIMARY_LANGUAGES),
  province: z.string().trim().length(2).default('QC'),
  publicContactEmail: z.boolean(),
  publicPrecision: z.enum(ASSOCIATION_PUBLIC_PRECISIONS),
  streetAddress: z.string().trim().max(220).optional().or(z.literal(''))
});
export const associationClaimSchema = z.object({
  associationId: z.string().uuid(),
  authorized: z.literal('on'),
  contactEmail: z.string().trim().email().max(254),
  locale: z.enum(['en', 'fr']),
  registryNumber: z.string().trim().min(2).max(64)
});

export const associationDecisionSchema = z.object({
  associationId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});

export const associationJoinRequestSchema = z.object({
  associationId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});

export const associationConnectRequestSchema = z
  .object({
    associationId: z.string().uuid(),
    locale: z.enum(['en', 'fr']),
    message: z.string().trim().min(10).max(1200),
    requesterEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
    requesterName: z.string().trim().min(2).max(140),
    requesterPhone: z.string().trim().min(7).max(40).optional().or(z.literal(''))
  })
  .refine((value) => value.requesterEmail !== '' || value.requesterPhone !== '', {
    message: 'KMG-RC-001',
    path: ['replyChannel']
  });

export const MAX_RPN_PROOF_BYTES = 10 * 1024 * 1024;
export const RPN_PROOF_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type RpnProofMimeType = (typeof RPN_PROOF_MIME_TYPES)[number];
