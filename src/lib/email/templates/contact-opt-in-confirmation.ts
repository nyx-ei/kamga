/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import type { EmailLocale, EmailTemplate } from '@/lib/email/templates/email-template-types';
import { emailShell, escapeHtml, primaryLink } from '@/lib/email/templates/html';

type ContactOptInConfirmationEmailParams = {
  associationName: string;
  confirmationUrl: string;
  locale: EmailLocale;
};

export function contactOptInConfirmationEmail(params: ContactOptInConfirmationEmailParams): EmailTemplate {
  if (params.locale === 'fr') {
    const subject = 'Confirmez les notifications Kamga de votre association';
    const title = 'Confirmez les notifications Kamga';
    const body = `Kamga peut utiliser ce courriel pour les notifications opérationnelles de ${params.associationName} seulement après votre confirmation. Cette confirmation ne rend jamais le courriel public.`;
    const cta = 'Confirmer ce courriel';

    return {
      subject,
      text: `${title}\n\n${body}\n\n${cta}: ${params.confirmationUrl}`,
      html: emailShell(`
        <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:24px;">${escapeHtml(body)}</p>
        ${primaryLink(params.confirmationUrl, cta)}
        <p style="margin:24px 0 0;font-size:13px;line-height:20px;color:#3b4968;">Ce lien confirme uniquement l'envoi de notifications système. Les coordonnées restent privées sauf consentement explicite séparé.</p>
      `)
    };
  }

  const subject = 'Confirm Kamga notifications for your association';
  const title = 'Confirm Kamga notifications';
  const body = `Kamga can use this email for operational notifications about ${params.associationName} only after you confirm. This never makes the email public.`;
  const cta = 'Confirm this email';

  return {
    subject,
    text: `${title}\n\n${body}\n\n${cta}: ${params.confirmationUrl}`,
    html: emailShell(`
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:24px;">${escapeHtml(body)}</p>
      ${primaryLink(params.confirmationUrl, cta)}
      <p style="margin:24px 0 0;font-size:13px;line-height:20px;color:#3b4968;">This link only confirms system notifications. Contact details remain private unless a separate public-field consent is given.</p>
    `)
  };
}