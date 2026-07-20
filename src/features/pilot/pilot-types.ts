import { z } from 'zod';

export const PILOT_ASSOCIATION_STATUSES = ['onboarding', 'active_pilot', 'iteration', 'completed', 'paused'] as const;
export const PILOT_FEEDBACK_CATEGORIES = ['onboarding', 'data_migration', 'member_flow', 'payments', 'general'] as const;
export const PILOT_WORKFLOW_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export const PILOT_MIGRATION_STATUSES = ['not_started', 'in_progress', 'completed', 'blocked'] as const;

export type PilotAssociationStatus = (typeof PILOT_ASSOCIATION_STATUSES)[number];
export type PilotFeedbackCategory = (typeof PILOT_FEEDBACK_CATEGORIES)[number];
export type PilotMigrationStatus = (typeof PILOT_MIGRATION_STATUSES)[number];
export type PilotWorkflowStatus = (typeof PILOT_WORKFLOW_STATUSES)[number];

export type PilotActionCode = 'KMG-AUTH-403' | 'KMG-PL-001' | 'KMG-PL-404' | 'KMG-PL-409' | 'KMG-SYS-000';

export type PilotActionState =
  | {
      ok: true;
    }
  | {
      code: PilotActionCode;
      ok: false;
    };

export const addPilotAssociationSchema = z.object({
  associationId: z.string().uuid(),
  locale: z.enum(['en', 'fr']),
  notes: z.string().trim().max(1200).optional()
});

export const updatePilotAssociationSchema = z.object({
  dataMigrationStatus: z.enum(PILOT_MIGRATION_STATUSES),
  guidedSetupStatus: z.enum(PILOT_WORKFLOW_STATUSES),
  locale: z.enum(['en', 'fr']),
  notes: z.string().trim().max(1200).optional(),
  pilotAssociationId: z.string().uuid(),
  status: z.enum(PILOT_ASSOCIATION_STATUSES)
});

export const addPilotFeedbackSchema = z.object({
  category: z.enum(PILOT_FEEDBACK_CATEGORIES),
  feedback: z.string().trim().min(3).max(2500),
  iterationNotes: z.string().trim().max(1500).optional(),
  locale: z.enum(['en', 'fr']),
  pilotAssociationId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional()
});

export const reviewPilotFeedbackSchema = z.object({
  feedbackId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});
