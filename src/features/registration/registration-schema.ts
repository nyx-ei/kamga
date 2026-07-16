import { z } from 'zod';

import { MEMBER_EVIDENCE_MIME_TYPES, type StoredMemberRegistration } from '@/features/registration/registration-types';
const storedEvidenceFileSchema = z.object({
  dataUrl: z.string().min(1),
  mimeType: z.enum(MEMBER_EVIDENCE_MIME_TYPES),
  name: z.string().trim().min(1).max(180)
});

export const memberRegistrationSchema = z.object({
  consent: z.literal(true),
  dateOfArrivalCanada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().min(1).max(80),
  governmentId: storedEvidenceFileSchema,
  immigrationProof: storedEvidenceFileSchema,
  lastName: z.string().trim().min(1).max(80),
  locale: z.enum(['en', 'fr']),
  phone: z.string().trim().min(7).max(30),
  referralToken: z.string().trim().length(21),
  sin: z.string().trim().regex(/^\d{3}[ -]?\d{3}[ -]?\d{3}$/)
}) satisfies z.ZodType<StoredMemberRegistration>;

export type ParsedMemberRegistration = z.infer<typeof memberRegistrationSchema>;

