import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'new_call_to_contribute',
  'payment_reminder',
  'payment_confirmation',
  'join_request_submitted',
  'join_request_approved',
  'join_request_declined',
  'levee_dispatched',
  'collection_milestone'
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationActionCode = 'KMG-AUTH-403' | 'KMG-NT-001' | 'KMG-SYS-000';

export type NotificationActionState =
  | {
      ok: true;
    }
  | {
      code: NotificationActionCode;
      ok: false;
    };

export const notificationIdSchema = z.object({
  notificationId: z.string().uuid()
});

export const paymentReminderSchema = z.object({
  contributionId: z.string().uuid(),
  locale: z.enum(['en', 'fr'])
});
