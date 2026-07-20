import { z } from 'zod';

export const ADMIN_FEE_MODELS = ['per_member', 'per_levee'] as const;
export const ADMIN_FEE_PAYOUT_METHODS = ['manual', 'stripe_connect'] as const;

export type AdminFeeModel = (typeof ADMIN_FEE_MODELS)[number];
export type AdminFeePayoutMethod = (typeof ADMIN_FEE_PAYOUT_METHODS)[number];

export type AdminFeeActionCode = 'KMG-AUTH-403' | 'KMG-FEE-001' | 'KMG-FEE-404' | 'KMG-FEE-STRIPE-CONFIG' | 'KMG-SYS-000';

export type AdminFeeActionState =
  | {
      ok: true;
      payoutId?: string;
    }
  | {
      ok: false;
      code: AdminFeeActionCode;
    };

export const updateAssociationAdminFeeSettingsSchema = z.object({
  associationId: z.string().uuid(),
  feeBps: z.number().int().min(0).max(10000),
  feeFixedCents: z.number().int().min(0),
  feeModel: z.enum(ADMIN_FEE_MODELS),
  isEnabled: z.boolean(),
  locale: z.enum(['en', 'fr']),
  payoutMethod: z.enum(ADMIN_FEE_PAYOUT_METHODS),
  stripeConnectAccountId: z.string().trim().max(120).optional()
});

export const createAdminFeePayoutSchema = z.object({
  associationAdminUserId: z.string().uuid(),
  associationId: z.string().uuid(),
  locale: z.enum(['en', 'fr']),
  method: z.enum(ADMIN_FEE_PAYOUT_METHODS)
});
