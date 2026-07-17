import { z } from 'zod';

export type LeveeActionCode = 'KMG-AUTH-403' | 'KMG-LV-001' | 'KMG-LV-002' | 'KMG-SYS-000';

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
