/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import type { EmailLocale, EmailTemplate } from '@/lib/email/templates/email-template-types';
import { emailShell, escapeHtml, primaryLink } from '@/lib/email/templates/html';

type ApplicationReceivedEmailParams = {
  associationName: string;
  dashboardUrl: string;
  firstName: string;
  locale: EmailLocale;
};

export function applicationReceivedEmail(params: ApplicationReceivedEmailParams): EmailTemplate {
  if (params.locale === 'fr') {
    const subject = 'Kamga - Demande membre recue';
    const text = `Bonjour ${params.firstName},

Votre demande membre pour ${params.associationName} a ete recue. Nous vous notifierons lorsque votre dossier aura ete revu.

Suivre votre dossier: ${params.dashboardUrl}`;

    return {
      subject,
      text,
      html: emailShell(`
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Bonjour ${escapeHtml(params.firstName)},</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Demande membre recue</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Votre demande membre pour <strong>${escapeHtml(params.associationName)}</strong> a ete recue.</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:24px;">Nous vous notifierons lorsque votre dossier aura ete revu par l'administrateur.</p>
        ${primaryLink(params.dashboardUrl, 'Ouvrir le tableau de bord')}
      `)
    };
  }

  const subject = 'Kamga - Member application received';
  const text = `Hello ${params.firstName},

Your member application for ${params.associationName} has been received. We will notify you when your file has been reviewed.

Track your file: ${params.dashboardUrl}`;

  return {
    subject,
    text,
    html: emailShell(`
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Hello ${escapeHtml(params.firstName)},</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Member application received</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Your member application for <strong>${escapeHtml(params.associationName)}</strong> has been received.</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:24px;">We will notify you when your file has been reviewed by the administrator.</p>
      ${primaryLink(params.dashboardUrl, 'Open dashboard')}
    `)
  };
}
