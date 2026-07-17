import { z } from 'zod';

import { createSimplePdf } from '@/lib/fiscal/pdf';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import 'server-only';

export type AnnualTaxReceiptLine = {
  amountAppliedCents: number;
  associationName: string;
  paidAt: string;
  provider: 'offline' | 'stripe';
  rpnId: string;
};

export type AnnualTaxReceipt = {
  generatedAt: string;
  lines: AnnualTaxReceiptLine[];
  memberEmail: string;
  memberName: string;
  totalAmountCents: number;
  year: number;
};

const paymentRowSchema = z.object({
  amount_applied_cents: z.number(),
  created_at: z.string(),
  provider: z.enum(['stripe', 'offline']),
  member_contributions: z
    .object({
      association_levee_calls: z
        .object({
          associations: z
            .object({
              id: z.string().uuid(),
              name: z.string(),
              rpn_id: z.string().nullable()
            })
            .nullable()
        })
        .nullable()
    })
    .nullable()
});

const userRowSchema = z.object({
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable()
});

function fiscalYearBounds(year: number): { end: string; start: string } {
  return {
    end: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
    start: new Date(Date.UTC(year, 0, 1)).toISOString()
  };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    currency: 'CAD',
    style: 'currency'
  }).format(cents / 100);
}

function memberName(user: z.infer<typeof userRowSchema>): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName.length > 0 ? fullName : user.email;
}

export function currentFiscalYear(): number {
  return new Date().getUTCFullYear();
}

export async function getAnnualTaxReceipt(userId: string, year: number): Promise<AnnualTaxReceipt | null> {
  const { start, end } = fiscalYearBounds(year);
  const supabase = createSupabaseAdminClient();
  const { data: userData, error: userError } = await supabase.from('users').select('email,first_name,last_name').eq('id', userId).maybeSingle();

  if (userError || userData === null) {
    return null;
  }

  const parsedUser = userRowSchema.safeParse(userData);

  if (!parsedUser.success) {
    return null;
  }

  const { data, error } = await supabase
    .from('member_contribution_payments')
    .select(
      'amount_applied_cents,created_at,provider,member_contributions:contribution_id(association_levee_calls:association_levee_call_id(associations:association_id(id,name,rpn_id)))'
    )
    .eq('payer_user_id', userId)
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true });

  if (error || data === null) {
    return null;
  }

  const lines = data.flatMap((row: unknown): AnnualTaxReceiptLine[] => {
    const parsed = paymentRowSchema.safeParse(row);

    if (!parsed.success) {
      return [];
    }

    const association = parsed.data.member_contributions?.association_levee_calls?.associations;

    if (association === null || association === undefined) {
      return [];
    }

    return [
      {
        amountAppliedCents: Math.round(parsed.data.amount_applied_cents),
        associationName: association.name,
        paidAt: parsed.data.created_at,
        provider: parsed.data.provider,
        rpnId: association.rpn_id ?? association.id
      }
    ];
  });

  return {
    generatedAt: new Date().toISOString(),
    lines,
    memberEmail: parsedUser.data.email,
    memberName: memberName(parsedUser.data),
    totalAmountCents: lines.reduce((total, line) => total + line.amountAppliedCents, 0),
    year
  };
}

export function annualTaxReceiptFilename(receipt: AnnualTaxReceipt): string {
  return `kamga-tax-receipt-${receipt.year}.pdf`;
}

export function buildAnnualTaxReceiptPdf(receipt: AnnualTaxReceipt): Buffer {
  const lines = [
    { size: 18, text: `Kamga annual tax receipt - ${receipt.year}` },
    { size: 11, text: `Generated at: ${new Date(receipt.generatedAt).toISOString()}` },
    { text: `Member: ${receipt.memberName}` },
    { text: `Email: ${receipt.memberEmail}` },
    { text: `Fiscal year: ${receipt.year}` },
    { text: `Total contributions: ${formatCents(receipt.totalAmountCents)}` },
    { text: '' },
    { size: 13, text: 'Contribution details' },
    ...receipt.lines.map((line) => ({
      text: `${new Date(line.paidAt).toISOString().slice(0, 10)} | ${line.associationName} | RPN ID: ${line.rpnId} | ${line.provider} | ${formatCents(line.amountAppliedCents)}`
    })),
    { text: '' },
    { size: 9, text: 'This receipt summarizes contribution payments recorded in Kamga for the selected fiscal year.' }
  ];

  return createSimplePdf(lines);
}
