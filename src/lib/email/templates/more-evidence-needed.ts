/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import type { RequestableEvidenceType } from '@/features/memberships/membership-types';
import type { EmailLocale, EmailTemplate } from '@/lib/email/templates/email-template-types';
import { emailShell, escapeHtml, primaryLink } from '@/lib/email/templates/html';

type MoreEvidenceNeededEmailParams = {
  associationName: string;
  evidenceTypes: RequestableEvidenceType[];
  locale: EmailLocale;
  uploadUrl: string;
};

function evidenceTypeLabel(evidenceType: RequestableEvidenceType, locale: EmailLocale): string {
  if (evidenceType === 'government_id') {
    return locale === 'fr' ? "piece d'identite gouvernementale" : 'government ID';
  }

  return locale === 'fr' ? "preuve du statut d'immigration" : 'proof of immigration status';
}

function evidenceList(evidenceTypes: RequestableEvidenceType[], locale: EmailLocale): string {
  return evidenceTypes.map((type) => evidenceTypeLabel(type, locale)).join(', ');
}

function evidenceHtmlList(evidenceTypes: RequestableEvidenceType[], locale: EmailLocale): string {
  return `<ul style="margin:0 0 24px;padding-left:20px;font-size:16px;line-height:24px;">${evidenceTypes
    .map((type) => `<li>${escapeHtml(evidenceTypeLabel(type, locale))}</li>`)
    .join('')}</ul>`;
}

export function moreEvidenceNeededEmail(params: MoreEvidenceNeededEmailParams): EmailTemplate {
  const requested = evidenceList(params.evidenceTypes, params.locale);

  if (params.locale === 'fr') {
    const subject = 'Kamga - Preuves complementaires requises';
    const text = `Des preuves complementaires sont requises pour ${params.associationName}: ${requested}.

Televersez les documents demandes ici: ${params.uploadUrl}`;

    return {
      subject,
      text,
      html: emailShell(`
        <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Preuves complementaires requises</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;">L'administrateur de <strong>${escapeHtml(params.associationName)}</strong> a besoin de documents complementaires.</p>
        ${evidenceHtmlList(params.evidenceTypes, params.locale)}
        ${primaryLink(params.uploadUrl, 'Televerser les documents')}
      `)
    };
  }

  const subject = 'Kamga - Additional evidence required';
  const text = `Additional evidence is required for ${params.associationName}: ${requested}.

Upload the requested documents here: ${params.uploadUrl}`;

  return {
    subject,
    text,
    html: emailShell(`
      <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;">Additional evidence required</h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:24px;">The administrator of <strong>${escapeHtml(params.associationName)}</strong> needs additional documents.</p>
      ${evidenceHtmlList(params.evidenceTypes, params.locale)}
      ${primaryLink(params.uploadUrl, 'Upload documents')}
    `)
  };
}
