/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import type { EmailLocale, EmailTemplate } from '@/lib/email/templates/email-template-types';
import { emailShell, escapeHtml, stripHtml } from '@/lib/email/templates/html';

type ApplicationDeclinedEmailParams = {
  associationName: string;
  declineReasonHtml: string;
  locale: EmailLocale;
};

export function applicationDeclinedEmail(params: ApplicationDeclinedEmailParams): EmailTemplate {
  if (params.locale === 'fr') {
    const subject = 'Kamga - Demande membre refusee';
    const text = `Votre demande membre pour ${params.associationName} a ete refusee.

Raison:
${stripHtml(params.declineReasonHtml)}

Vous pourrez recevoir une nouvelle invitation si une association souhaite relancer votre inscription.`;

    return {
      subject,
      text,
      html: emailShell(`
        <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Demande refusee</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Votre demande membre pour <strong>${escapeHtml(params.associationName)}</strong> a ete refusee.</p>
        <div style="margin:0 0 24px;padding:16px;border:1px solid #d8dfec;border-radius:4px;background:#fff8dc;font-size:16px;line-height:24px;">${params.declineReasonHtml}</div>
        <p style="margin:0;font-size:16px;line-height:24px;">Vous pourrez recevoir une nouvelle invitation si une association souhaite relancer votre inscription.</p>
      `)
    };
  }

  const subject = 'Kamga - Member application declined';
  const text = `Your member application for ${params.associationName} was declined.

Reason:
${stripHtml(params.declineReasonHtml)}

You can receive a new invite if an association wants to restart your registration.`;

  return {
    subject,
    text,
    html: emailShell(`
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Application declined</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Your member application for <strong>${escapeHtml(params.associationName)}</strong> was declined.</p>
      <div style="margin:0 0 24px;padding:16px;border:1px solid #d8dfec;border-radius:4px;background:#fff8dc;font-size:16px;line-height:24px;">${params.declineReasonHtml}</div>
      <p style="margin:0;font-size:16px;line-height:24px;">You can receive a new invite if an association wants to restart your registration.</p>
    `)
  };
}
