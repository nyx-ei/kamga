import { z } from 'zod';

import type { NotificationType } from '@/features/notifications';
import { emailDefaults, resend } from '@/lib/email/resend';
import type { EmailLocale } from '@/lib/email/templates';
import { notificationEmail } from '@/lib/email/templates';
import { publicEnv } from '@/lib/env/public-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import 'server-only';

type NotificationInput = {
  body: string;
  href?: string;
  payload?: Record<string, unknown>;
  recipientUserId: string;
  sendEmail?: boolean;
  title: string;
  type: NotificationType;
};

const userContactSchema = z.object({
  email: z.string().nullable(),
  locale: z.string().nullable()
});

const userIdSchema = z.object({
  user_id: z.string().uuid()
});

const roleUserIdSchema = z.object({
  user_id: z.string().uuid()
});

function absoluteUrl(href: string | undefined): string | undefined {
  if (href === undefined) {
    return undefined;
  }

  return new URL(href, publicEnv.NEXT_PUBLIC_APP_URL).toString();
}

function emailLocale(locale: string | null | undefined): EmailLocale {
  return locale === 'fr' ? 'fr' : 'en';
}

async function userContact(userId: string): Promise<z.infer<typeof userContactSchema> | null> {
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.from('users').select('email,locale').eq('id', userId).maybeSingle();

  if (error || data === null) {
    return null;
  }

  const parsed = userContactSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function createNotification(input: NotificationInput): Promise<void> {
  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.from('notifications').insert({
    body: input.body,
    href: input.href ?? null,
    payload: input.payload ?? {},
    recipient_user_id: input.recipientUserId,
    title: input.title,
    type: input.type
  });

  if (input.sendEmail !== true) {
    return;
  }

  const contact = await userContact(input.recipientUserId);

  if (contact?.email === null || contact?.email === undefined) {
    return;
  }

  const template = notificationEmail({
    body: input.body,
    ctaUrl: absoluteUrl(input.href),
    locale: emailLocale(contact.locale),
    title: input.title
  });

  await resend.emails.send({
    from: emailDefaults.from,
    html: template.html,
    subject: template.subject,
    text: template.text,
    to: contact.email
  });
}

async function platformAdminIds(): Promise<string[]> {
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.from('user_roles').select('user_id').eq('role', 'platform_admin');

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = roleUserIdSchema.safeParse(row);
    return parsed.success ? [parsed.data.user_id] : [];
  });
}

async function associationAdminIds(associationId: string): Promise<string[]> {
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase
    .from('association_members')
    .select('user_id')
    .eq('association_id', associationId)
    .eq('role', 'association_admin')
    .eq('status', 'active');

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = userIdSchema.safeParse(row);
    return parsed.success ? [parsed.data.user_id] : [];
  });
}

async function notifyMany(userIds: string[], input: Omit<NotificationInput, 'recipientUserId'>): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];
  await Promise.all(uniqueUserIds.map((recipientUserId) => createNotification({ ...input, recipientUserId })));
}

export async function notifyJoinRequestSubmitted(params: { applicantName: string; associationId: string; associationName: string; locale: 'en' | 'fr' }): Promise<void> {
  const href = `/${params.locale}/dashboard`;
  const title = params.locale === 'fr' ? 'Nouvelle demande d adhesion' : 'New join request';
  const body =
    params.locale === 'fr'
      ? `${params.applicantName} souhaite rejoindre ${params.associationName}.`
      : `${params.applicantName} wants to join ${params.associationName}.`;
  await notifyMany([...(await associationAdminIds(params.associationId)), ...(await platformAdminIds())], {
    body,
    href,
    payload: { associationId: params.associationId },
    title,
    type: 'join_request_submitted'
  });
}

export async function notifyMembershipDecision(params: { associationName: string; decision: 'active' | 'declined'; locale: 'en' | 'fr'; userId: string }): Promise<void> {
  const approved = params.decision === 'active';
  await createNotification({
    body:
      params.locale === 'fr'
        ? `Votre demande pour ${params.associationName} a ete ${approved ? 'approuvee' : 'declinee'}.`
        : `Your application for ${params.associationName} was ${approved ? 'approved' : 'declined'}.`,
    href: `/${params.locale}/dashboard`,
    recipientUserId: params.userId,
    sendEmail: false,
    title: params.locale === 'fr' ? 'Statut de demande mis a jour' : 'Application status updated',
    type: approved ? 'join_request_approved' : 'join_request_declined'
  });
}

export async function notifyPaymentConfirmation(params: { amountCents: number; contributionId: string; locale: 'en' | 'fr'; userId: string }): Promise<void> {
  const amount = new Intl.NumberFormat(params.locale === 'fr' ? 'fr-CA' : 'en-CA', { currency: 'CAD', style: 'currency' }).format(params.amountCents / 100);
  await createNotification({
    body: params.locale === 'fr' ? `Votre paiement de ${amount} a ete confirme.` : `Your ${amount} payment was confirmed.`,
    href: `/${params.locale}/dashboard`,
    payload: { contributionId: params.contributionId },
    recipientUserId: params.userId,
    sendEmail: true,
    title: params.locale === 'fr' ? 'Paiement confirme' : 'Payment confirmed',
    type: 'payment_confirmation'
  });
}

const leveeCallSchema = z.object({
  amount_due_cents: z.number(),
  association_id: z.string().uuid(),
  associations: z.union([z.object({ name: z.string() }), z.array(z.object({ name: z.string() }))]).nullable(),
  id: z.string().uuid(),
  levees: z
    .object({
      deceased_full_name: z.string()
    })
    .nullable()
});

const memberContributionSchema = z.object({
  amount_due_cents: z.number(),
  association_members: z
    .union([z.object({ user_id: z.string().uuid() }), z.array(z.object({ user_id: z.string().uuid() }))])
    .nullable(),
  id: z.string().uuid()
});

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function notifyLeveeDispatched(params: { leveeId: string; locale: 'en' | 'fr' }): Promise<void> {
  const adminSupabase = createSupabaseAdminClient();
  const { data } = await adminSupabase
    .from('association_levee_calls')
    .select('id,association_id,amount_due_cents,associations:association_id(name),levees:levee_id(deceased_full_name)')
    .eq('levee_id', params.leveeId);

  if (data === null) {
    return;
  }

  for (const row of data) {
    const parsedCall = leveeCallSchema.safeParse(row);

    if (!parsedCall.success) {
      continue;
    }

    const association = singleRelation(parsedCall.data.associations);
    const associationName = association?.name ?? 'Kamga';
    await notifyMany(await associationAdminIds(parsedCall.data.association_id), {
      body:
        params.locale === 'fr'
          ? `Un nouvel appel de levee a ete envoye a ${associationName}.`
          : `A new levee call was dispatched to ${associationName}.`,
      href: `/${params.locale}/dashboard`,
      payload: { callId: parsedCall.data.id, leveeId: params.leveeId },
      sendEmail: true,
      title: params.locale === 'fr' ? 'Levee envoyee' : 'Levee dispatched',
      type: 'levee_dispatched'
    });

    const { data: contributions } = await adminSupabase
      .from('member_contributions')
      .select('id,amount_due_cents,association_members:membership_id(user_id)')
      .eq('association_levee_call_id', parsedCall.data.id);

    for (const contributionRow of contributions ?? []) {
      const parsedContribution = memberContributionSchema.safeParse(contributionRow);
      const membership = parsedContribution.success ? singleRelation(parsedContribution.data.association_members) : null;

      if (!parsedContribution.success || membership === null) {
        continue;
      }

      await createNotification({
        body:
          params.locale === 'fr'
            ? `Un nouvel appel de contribution est disponible pour ${associationName}.`
            : `A new contribution call is available for ${associationName}.`,
        href: `/${params.locale}/dashboard`,
        payload: { contributionId: parsedContribution.data.id },
        recipientUserId: membership.user_id,
        sendEmail: true,
        title: params.locale === 'fr' ? 'Nouvelle contribution a payer' : 'New contribution to pay',
        type: 'new_call_to_contribute'
      });
    }
  }
}

const contributionReminderSchema = z.object({
  amount_due_cents: z.number(),
  amount_paid_cents: z.number(),
  association_levee_calls: z
    .object({
      associations: z.union([z.object({ name: z.string() }), z.array(z.object({ name: z.string() }))]).nullable()
    })
    .nullable(),
  association_members: z.union([z.object({ user_id: z.string().uuid() }), z.array(z.object({ user_id: z.string().uuid() }))]).nullable(),
  id: z.string().uuid()
});

export async function notifyPaymentReminder(params: { contributionId: string; locale: 'en' | 'fr' }): Promise<boolean> {
  const adminSupabase = createSupabaseAdminClient();
  const { data } = await adminSupabase
    .from('member_contributions')
    .select('id,amount_due_cents,amount_paid_cents,association_members:membership_id(user_id),association_levee_calls:association_levee_call_id(associations:association_id(name))')
    .eq('id', params.contributionId)
    .maybeSingle();
  const parsed = contributionReminderSchema.safeParse(data);

  if (!parsed.success) {
    return false;
  }

  const membership = singleRelation(parsed.data.association_members);

  if (membership === null) {
    return false;
  }

  const association = singleRelation(parsed.data.association_levee_calls?.associations);
  const amount = new Intl.NumberFormat(params.locale === 'fr' ? 'fr-CA' : 'en-CA', { currency: 'CAD', style: 'currency' }).format(
    Math.max(0, parsed.data.amount_due_cents - parsed.data.amount_paid_cents) / 100
  );

  await createNotification({
    body:
      params.locale === 'fr'
        ? `Rappel: il reste ${amount} a payer pour ${association?.name ?? 'Kamga'}.`
        : `Reminder: ${amount} remains due for ${association?.name ?? 'Kamga'}.`,
    href: `/${params.locale}/dashboard`,
    payload: { contributionId: params.contributionId },
    recipientUserId: membership.user_id,
    sendEmail: true,
    title: params.locale === 'fr' ? 'Rappel de paiement' : 'Payment reminder',
    type: 'payment_reminder'
  });

  return true;
}

export async function notifyCollectionMilestone(params: { associationId: string; locale: 'en' | 'fr'; message: string }): Promise<void> {
  await notifyMany(await associationAdminIds(params.associationId), {
    body: params.message,
    href: `/${params.locale}/dashboard`,
    payload: { associationId: params.associationId },
    title: params.locale === 'fr' ? 'Jalon de collecte atteint' : 'Collection milestone reached',
    type: 'collection_milestone'
  });
}
