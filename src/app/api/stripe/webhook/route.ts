import type Stripe from 'stripe';

import { notifyCollectionMilestone, notifyPaymentConfirmation } from '@/lib/notifications/server';
import { createStripeServerClient, requireStripeWebhookSecret } from '@/lib/stripe/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function metadataValue(metadata: Stripe.Metadata | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function receiptUrlFromPaymentIntent(paymentIntent: Stripe.PaymentIntent | null): string {
  const charge = typeof paymentIntent?.latest_charge === 'string' ? null : paymentIntent?.latest_charge;
  return charge?.receipt_url ?? '';
}

export async function POST(request: Request) {
  const stripe = createStripeServerClient();
  const webhookSecret = requireStripeWebhookSecret();
  const signature = request.headers.get('stripe-signature');

  if (signature === null) {
    return new Response('Missing Stripe signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return new Response('Invalid Stripe signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true });
  }

  const session = event.data.object;
  const contributionId = metadataValue(session.metadata, 'contributionId');
  const userId = metadataValue(session.metadata, 'userId');
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const amountTotal = session.amount_total;

  if (contributionId === null || userId === null || amountTotal === null) {
    return new Response('Missing session metadata', { status: 400 });
  }

  const paymentIntent =
    paymentIntentId === null
      ? null
      : await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['latest_charge']
        });
  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.rpc('apply_stripe_member_contribution_payment', {
    amount_received_cents_value: amountTotal,
    checkout_session_id_value: session.id,
    contribution_uuid: contributionId,
    payer_uuid: userId,
    payment_intent_id_value: paymentIntentId ?? '',
    receipt_url_value: receiptUrlFromPaymentIntent(paymentIntent)
  });

  if (error) {
    return new Response('Payment application failed', { status: 500 });
  }

  await notifyPaymentConfirmation({
    amountCents: amountTotal,
    contributionId,
    locale: 'en',
    userId
  });

  const { data: contribution } = await adminSupabase
    .from('member_contributions')
    .select('status,association_levee_calls:association_levee_call_id(association_id)')
    .eq('id', contributionId)
    .maybeSingle();
  const call = Array.isArray(contribution?.association_levee_calls) ? contribution?.association_levee_calls[0] : contribution?.association_levee_calls;

  if (contribution?.status === 'paid' && typeof call?.association_id === 'string') {
    await notifyCollectionMilestone({
      associationId: call.association_id,
      locale: 'en',
      message: 'A member contribution has been fully paid.'
    });
  }

  return Response.json({ received: true });
}
