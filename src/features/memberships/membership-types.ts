import { z } from 'zod';

export const MEMBERSHIP_REVIEW_DECISIONS = ['active', 'declined'] as const;

export type MembershipReviewDecision = (typeof MEMBERSHIP_REVIEW_DECISIONS)[number];

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

export const sinRevealSchema = z.object({
  membershipId: z.string().uuid()
});
