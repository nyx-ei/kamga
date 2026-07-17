import { z } from 'zod';

export const MEMBERSHIP_REVIEW_DECISIONS = ['active', 'declined'] as const;
export const REQUESTABLE_EVIDENCE_TYPES = ['government_id', 'immigration_proof'] as const;

export type MembershipReviewDecision = (typeof MEMBERSHIP_REVIEW_DECISIONS)[number];
export type RequestableEvidenceType = (typeof REQUESTABLE_EVIDENCE_TYPES)[number];

export type MembershipActionCode = 'KMG-AUTH-403' | 'KMG-RG-001' | 'KMG-RG-404' | 'KMG-RG-409' | 'KMG-SYS-000';

export type MembershipActionState =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: MembershipActionCode;
    };

export type SINRevealResult =
  | {
      ok: true;
      sin: string;
    }
  | {
      ok: false;
      code: MembershipActionCode;
    };

export const membershipReviewSchema = z.object({
  membershipId: z.string().uuid(),
  decision: z.enum(MEMBERSHIP_REVIEW_DECISIONS),
  locale: z.enum(['en', 'fr'])
});

export const declineMemberSchema = z.object({
  declineReasonHtml: z.string().trim().min(10).max(4000),
  locale: z.enum(['en', 'fr']),
  membershipId: z.string().uuid()
});

export const requestMoreEvidenceSchema = z.object({
  evidenceTypes: z.array(z.enum(REQUESTABLE_EVIDENCE_TYPES)).min(1),
  locale: z.enum(['en', 'fr']),
  membershipId: z.string().uuid()
});

export const sinRevealSchema = z.object({
  membershipId: z.string().uuid()
});

export const dependentSchema = z.object({
  externalId: z.string().trim().max(120).optional(),
  fullName: z.string().trim().min(2).max(160),
  membershipId: z.string().uuid(),
  relationship: z.string().trim().min(2).max(80)
});

export const removeDependentSchema = z.object({
  dependentId: z.string().uuid(),
  membershipId: z.string().uuid()
});
