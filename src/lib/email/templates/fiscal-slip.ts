/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import type { EmailLocale, EmailTemplate } from '@/lib/email/templates/email-template-types';
import { emailShell, escapeHtml } from '@/lib/email/templates/html';

type FiscalSlipEmailParams = {
  locale: EmailLocale;
  memberName: string;
  totalAmount: string;
  year: number;
};

export function fiscalSlipEmail(params: FiscalSlipEmailParams): EmailTemplate {
  if (params.locale === 'fr') {
    const subject = `Kamga - Recu fiscal ${params.year}`;
    const text = `Bonjour ${params.memberName},

Votre recu fiscal Kamga ${params.year} est joint a ce courriel.

Total des contributions: ${params.totalAmount}`;

    return {
      subject,
      text,
      html: emailShell(`
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Bonjour ${escapeHtml(params.memberName)},</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Recu fiscal ${params.year}</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Votre recu fiscal Kamga est joint a ce courriel.</p>
        <p style="margin:0;font-size:16px;line-height:24px;">Total des contributions : <strong>${escapeHtml(params.totalAmount)}</strong></p>
      `)
    };
  }

  const subject = `Kamga - ${params.year} tax receipt`;
  const text = `Hello ${params.memberName},

Your ${params.year} Kamga tax receipt is attached to this email.

Total contributions: ${params.totalAmount}`;

  return {
    subject,
    text,
    html: emailShell(`
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Hello ${escapeHtml(params.memberName)},</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">${params.year} tax receipt</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">Your Kamga tax receipt is attached to this email.</p>
      <p style="margin:0;font-size:16px;line-height:24px;">Total contributions: <strong>${escapeHtml(params.totalAmount)}</strong></p>
    `)
  };
}
