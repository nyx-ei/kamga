/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import type { EmailLocale, EmailTemplate } from '@/lib/email/templates/email-template-types';
import { emailShell, escapeHtml, primaryLink } from '@/lib/email/templates/html';

type NotificationEmailParams = {
  body: string;
  ctaUrl?: string;
  locale: EmailLocale;
  title: string;
};

export function notificationEmail(params: NotificationEmailParams): EmailTemplate {
  const ctaLabel = params.locale === 'fr' ? 'Ouvrir Kamga' : 'Open Kamga';
  const subjectPrefix = params.locale === 'fr' ? 'Kamga - Notification' : 'Kamga - Notification';
  const ctaText = params.ctaUrl === undefined ? '' : `\n\n${ctaLabel}: ${params.ctaUrl}`;

  return {
    subject: `${subjectPrefix}: ${params.title}`,
    text: `${params.title}\n\n${params.body}${ctaText}`,
    html: emailShell(`
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">${escapeHtml(params.title)}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:24px;">${escapeHtml(params.body)}</p>
      ${params.ctaUrl === undefined ? '' : primaryLink(params.ctaUrl, ctaLabel)}
    `)
  };
}
