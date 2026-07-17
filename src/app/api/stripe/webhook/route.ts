import type Stripe from 'stripe';

import { createStripeServerClient, requireStripeWebhookSecret } from '@/lib/stripe/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function metadataValue(metadata: Stripe.Metadata | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
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

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.rpc('apply_stripe_member_contribution_payment', {
    amount_received_cents_value: amountTotal,
    checkout_session_id_value: session.id,
    contribution_uuid: contributionId,
    payer_uuid: userId,
    payment_intent_id_value: paymentIntentId ?? ''
  });

  if (error) {
    return new Response('Payment application failed', { status: 500 });
  }

  return Response.json({ received: true });
}
