import { z } from 'zod';

export const ASSOCIATION_LEVEE_CALL_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export const MEMBER_CONTRIBUTION_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export const PAYMENT_PREFERENCES = ['manual', 'auto_pay'] as const;

export type AssociationLeveeCallStatus = (typeof ASSOCIATION_LEVEE_CALL_STATUSES)[number];
export type MemberContributionStatus = (typeof MEMBER_CONTRIBUTION_STATUSES)[number];
export type PaymentPreference = (typeof PAYMENT_PREFERENCES)[number];
export type LeveeActionCode =
  | 'KMG-AUTH-403'
  | 'KMG-LV-001'
  | 'KMG-LV-002'
  | 'KMG-LV-003'
  | 'KMG-LV-404'
  | 'KMG-PAY-001'
  | 'KMG-PAY-CONFIG'
  | 'KMG-SYS-000';

export type LeveeActionState =
  | {
      ok: true;
      leveeId?: string;
      perShareAmountCents?: number;
      poolSize?: number;
    }
  | {
      ok: false;
      code: LeveeActionCode;
    };

export const createLeveeSchema = z.object({
  deadline: z.string().date(),
  deceasedCity: z.string().trim().max(120).optional(),
  deceasedDateOfDeath: z.string().date().optional(),
  deceasedFullName: z.string().trim().min(2).max(180),
  locale: z.enum(['en', 'fr']),
  targetAmountCents: z.number().int().positive()
});

export const updateAssociationLeveeCallStatusSchema = z.object({
  callId: z.string().uuid(),
  locale: z.enum(['en', 'fr']),
  status: z.enum(ASSOCIATION_LEVEE_CALL_STATUSES)
});

export const recordMemberContributionPaymentSchema = z.object({
  amountPaidCents: z.number().int().min(0),
  contributionId: z.string().uuid(),
  locale: z.enum(['en', 'fr']),
  note: z.string().trim().max(500).optional()
});

export const startStripeContributionCheckoutSchema = z.object({
  contributionId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});

export const startStripeCustomerPortalSchema = z.object({
  locale: z.enum(['en', 'fr'])
});

export const updatePaymentPreferenceSchema = z.object({
  locale: z.enum(['en', 'fr']),
  paymentPreference: z.enum(PAYMENT_PREFERENCES)
});

export const markAssociationLeveeCallRemittedSchema = z.object({
  callId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});

export const closeLeveeIfReadySchema = z.object({
  leveeId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});
