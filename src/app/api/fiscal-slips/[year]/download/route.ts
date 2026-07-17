import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { annualTaxReceiptFilename, buildAnnualTaxReceiptPdf, getAnnualTaxReceipt } from '@/lib/fiscal/tax-receipts';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100)
});

export async function GET(_request: Request, { params }: { params: { year: string } }) {
  const currentUser = await requireUser();
  const parsed = paramsSchema.safeParse(params);

  if (!parsed.success) {
    return new Response('Invalid fiscal year', { status: 400 });
  }

  const receipt = await getAnnualTaxReceipt(currentUser.user.id, parsed.data.year);

  if (receipt === null || receipt.lines.length === 0) {
    return new Response('No fiscal receipt available for this year', { status: 404 });
  }

  const pdf = buildAnnualTaxReceiptPdf(receipt);

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${annualTaxReceiptFilename(receipt)}"`,
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
