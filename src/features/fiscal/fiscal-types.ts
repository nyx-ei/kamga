import { z } from 'zod';

export type FiscalActionCode = 'KMG-FS-001' | 'KMG-FS-404' | 'KMG-SYS-000';

export type FiscalActionState =
  | {
      ok: true;
      sent?: boolean;
    }
  | {
      code: FiscalActionCode;
      ok: false;
    };

export const fiscalSlipRequestSchema = z.object({
  locale: z.enum(['en', 'fr']),
  year: z.coerce.number().int().min(2020).max(2100)
});
