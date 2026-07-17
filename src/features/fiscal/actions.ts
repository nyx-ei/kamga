'use server';

import { revalidatePath } from 'next/cache';

import { type FiscalActionState, fiscalSlipRequestSchema } from '@/features/fiscal/fiscal-types';
import { requireUser } from '@/lib/auth';
import { emailDefaults, resend } from '@/lib/email/resend';
import { fiscalSlipEmail } from '@/lib/email/templates';
import { annualTaxReceiptFilename, buildAnnualTaxReceiptPdf, getAnnualTaxReceipt } from '@/lib/fiscal/tax-receipts';

const INITIAL_ERROR_STATE: FiscalActionState = { ok: true };

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function formatCents(cents: number, locale: 'en' | 'fr'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    currency: 'CAD',
    style: 'currency'
  }).format(cents / 100);
}

export async function emailFiscalSlip(_previousState: FiscalActionState = INITIAL_ERROR_STATE, formData: FormData): Promise<FiscalActionState> {
  const currentUser = await requireUser();
  const parsed = fiscalSlipRequestSchema.safeParse({
    locale: valueFromFormData(formData, 'locale'),
    year: valueFromFormData(formData, 'year')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-FS-001' };
  }

  const receipt = await getAnnualTaxReceipt(currentUser.user.id, parsed.data.year);

  if (receipt === null || receipt.lines.length === 0) {
    return { ok: false, code: 'KMG-FS-404' };
  }

  const pdf = buildAnnualTaxReceiptPdf(receipt);
  const template = fiscalSlipEmail({
    locale: parsed.data.locale,
    memberName: receipt.memberName,
    totalAmount: formatCents(receipt.totalAmountCents, parsed.data.locale),
    year: receipt.year
  });

  const { error } = await resend.emails.send({
    attachments: [
      {
        content: pdf.toString('base64'),
        filename: annualTaxReceiptFilename(receipt)
      }
    ],
    from: emailDefaults.from,
    html: template.html,
    subject: template.subject,
    text: template.text,
    to: receipt.memberEmail
  });

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);

  return { ok: true, sent: true };
}
