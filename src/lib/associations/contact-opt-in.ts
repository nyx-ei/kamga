/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

import { contactOptInConfirmationEmail } from '@/lib/email/templates';
import { emailDefaults, resend } from '@/lib/email/resend';
import type { EmailLocale } from '@/lib/email/templates';
import { publicEnv } from '@/lib/env/public-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const CONFIRMATION_TOKEN_LENGTH = 32;
const TOKEN_TTL_DAYS = 30;
const FIBONACCI_RESEND_GAPS_DAYS = [1, 2, 3, 5] as const;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function nextConfirmationSendAt(sendCount: number, sentAt: Date): string | null {
  const gap = FIBONACCI_RESEND_GAPS_DAYS[sendCount - 1];
  return gap === undefined ? null : addDays(sentAt, gap);
}

type SendContactOptInConfirmationParams = {
  associationId: string;
  associationName: string;
  email: string | null;
  locale: EmailLocale;
};

export async function sendContactOptInConfirmation(params: SendContactOptInConfirmationParams): Promise<void> {
  if (params.email === null || params.email.trim().length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const token = nanoid(CONFIRMATION_TOKEN_LENGTH);
  const now = new Date();
  const expiresAt = addDays(now, TOKEN_TTL_DAYS);

  await supabase
    .from('association_contact_opt_in_tokens')
    .update({ consumed_at: now.toISOString() })
    .eq('association_id', params.associationId)
    .eq('purpose', 'confirm')
    .is('consumed_at', null);

  const { error: tokenError } = await supabase.from('association_contact_opt_in_tokens').insert({
    association_id: params.associationId,
    email: params.email.trim().toLowerCase(),
    expires_at: expiresAt,
    locale: params.locale,
    purpose: 'confirm',
    token_hash: hashToken(token)
  });

  if (tokenError) {
    return;
  }

  const { data: association } = await supabase
    .from('associations')
    .select('contact_notification_confirmation_send_count')
    .eq('id', params.associationId)
    .maybeSingle();

  const previousSendCount = typeof association?.contact_notification_confirmation_send_count === 'number' ? association.contact_notification_confirmation_send_count : 0;
  const nextSendCount = previousSendCount + 1;
  const nextSendAt = nextConfirmationSendAt(nextSendCount, now);

  await supabase
    .from('associations')
    .update({
      contact_notification_confirmation_next_send_at: nextSendAt,
      contact_notification_confirmation_send_count: nextSendCount,
      contact_notification_confirmation_sent_at: now.toISOString(),
      contact_notification_opt_in_status: 'pending',
      contact_notification_opted_in_at: null,
      contact_notification_withdrawn_at: null
    })
    .eq('id', params.associationId);

  const confirmationUrl = new URL(`/${params.locale}/associations/contact-opt-in/confirm`, publicEnv.NEXT_PUBLIC_APP_URL);
  confirmationUrl.searchParams.set('token', token);

  const template = contactOptInConfirmationEmail({
    associationName: params.associationName,
    confirmationUrl: confirmationUrl.toString(),
    locale: params.locale
  });

  await resend.emails.send({
    from: emailDefaults.from,
    html: template.html,
    subject: template.subject,
    text: template.text,
    to: params.email
  });
}

type ConfirmContactOptInResult =
  | { ok: true; associationName: string }
  | { ok: false; code: 'expired' | 'invalid' | 'used' };

export async function confirmContactNotificationOptIn(token: string | undefined): Promise<ConfirmContactOptInResult> {
  if (token === undefined || token.trim().length === 0) {
    return { ok: false, code: 'invalid' };
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = hashToken(token.trim());
  const { data: tokenRow, error } = await supabase
    .from('association_contact_opt_in_tokens')
    .select('id,association_id,email,expires_at,consumed_at')
    .eq('token_hash', tokenHash)
    .eq('purpose', 'confirm')
    .maybeSingle();

  if (error || tokenRow === null) {
    return { ok: false, code: 'invalid' };
  }

  if (tokenRow.consumed_at !== null) {
    return { ok: false, code: 'used' };
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { ok: false, code: 'expired' };
  }

  const now = new Date().toISOString();
  const { data: association, error: updateError } = await supabase
    .from('associations')
    .update({
      contact_notification_confirmation_next_send_at: null,
      contact_notification_opt_in_status: 'confirmed',
      contact_notification_opted_in_at: now,
      contact_notification_withdrawn_at: null
    })
    .eq('id', tokenRow.association_id)
    .eq('contact_email', tokenRow.email)
    .select('name')
    .maybeSingle();

  if (updateError || association === null) {
    return { ok: false, code: 'invalid' };
  }

  await supabase.from('association_contact_opt_in_tokens').update({ consumed_at: now }).eq('id', tokenRow.id);

  return { ok: true, associationName: typeof association.name === 'string' ? association.name : 'Kamga' };
}