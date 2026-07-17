/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import type { EmailLocale, EmailTemplate } from '@/lib/email/templates/email-template-types';
import { emailShell, escapeHtml, primaryLink } from '@/lib/email/templates/html';

type ApplicationApprovedEmailParams = {
  associationName: string;
  dashboardUrl: string;
  locale: EmailLocale;
};

export function applicationApprovedEmail(params: ApplicationApprovedEmailParams): EmailTemplate {
  if (params.locale === 'fr') {
    const subject = 'Kamga - Demande membre approuvee';
    const text = `Felicitations,

Votre demande membre pour ${params.associationName} a ete approuvee. Ouvrez votre tableau de bord pour consulter les prochaines etapes.

Tableau de bord: ${params.dashboardUrl}`;

    return {
      subject,
      text,
      html: emailShell(`
        <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Demande approuvee</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Felicitations, votre demande membre pour <strong>${escapeHtml(params.associationName)}</strong> a ete approuvee.</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:24px;">Ouvrez votre tableau de bord Kamga pour consulter les prochaines etapes.</p>
        ${primaryLink(params.dashboardUrl, 'Ouvrir le tableau de bord')}
      `)
    };
  }

  const subject = 'Kamga - Member application approved';
  const text = `Congratulations,

Your member application for ${params.associationName} was approved. Open your dashboard to review the next steps.

Dashboard: ${params.dashboardUrl}`;

  return {
    subject,
    text,
    html: emailShell(`
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Application approved</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Congratulations, your member application for <strong>${escapeHtml(params.associationName)}</strong> was approved.</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:24px;">Open your Kamga dashboard to review the next steps.</p>
      ${primaryLink(params.dashboardUrl, 'Open dashboard')}
    `)
  };
}
