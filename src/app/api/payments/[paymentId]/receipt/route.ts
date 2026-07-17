import type Stripe from 'stripe';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { createStripeServerClient } from '@/lib/stripe/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const routeParamsSchema = z.object({
  paymentId: z.string().uuid()
});

const paymentSchema = z.object({
  id: z.string().uuid(),
  stripe_payment_intent_id: z.string().nullable(),
  stripe_receipt_url: z.string().nullable()
});

function receiptUrlFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): string | null {
  const charge = typeof paymentIntent.latest_charge === 'string' ? null : paymentIntent.latest_charge;
  return charge?.receipt_url ?? null;
}

export async function GET(_request: Request, { params }: { params: { paymentId: string } }) {
  await requireUser();

  const parsedParams = routeParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return new Response('Invalid payment id', { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('member_contribution_payments')
    .select('id,stripe_payment_intent_id,stripe_receipt_url')
    .eq('id', parsedParams.data.paymentId)
    .maybeSingle();

  if (error) {
    return new Response('Payment lookup failed', { status: 500 });
  }

  if (data === null) {
    return new Response('Payment not found', { status: 404 });
  }

  const payment = paymentSchema.safeParse(data);

  if (!payment.success) {
    return new Response('Invalid payment record', { status: 500 });
  }

  if (payment.data.stripe_receipt_url !== null && payment.data.stripe_receipt_url.length > 0) {
    return Response.redirect(payment.data.stripe_receipt_url, 303);
  }

  if (payment.data.stripe_payment_intent_id === null || payment.data.stripe_payment_intent_id.length === 0) {
    return new Response('Receipt unavailable', { status: 404 });
  }

  const stripe = createStripeServerClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.data.stripe_payment_intent_id, {
    expand: ['latest_charge']
  });
  const receiptUrl = receiptUrlFromPaymentIntent(paymentIntent);

  if (receiptUrl === null) {
    return new Response('Receipt unavailable', { status: 404 });
  }

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.from('member_contribution_payments').update({ stripe_receipt_url: receiptUrl }).eq('id', payment.data.id);

  return Response.redirect(receiptUrl, 303);
}
