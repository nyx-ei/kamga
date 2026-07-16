import { z } from 'zod';

export type ReferralActionCode = 'KMG-AUTH-401' | 'KMG-AUTH-403' | 'KMG-REF-001' | 'KMG-REF-002' | 'KMG-SYS-000';

export type ReferralActionState =
  | {
      ok: true;
      referralUrl?: string;
    }
  | {
      ok: false;
      code: ReferralActionCode;
    };

export const referralCreationSchema = z.object({
  associationId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});

export const referralSettingsSchema = z.object({
  associationId: z.string().uuid(),
  allowMemberReferrals: z.enum(['on']).optional(),
  locale: z.enum(['en', 'fr'])
});
