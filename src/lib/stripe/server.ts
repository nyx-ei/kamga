import Stripe from 'stripe';

import { env } from '@/lib/env/server-env';

import 'server-only';

export function createStripeServerClient(): Stripe {
  if (env.STRIPE_SECRET_KEY === undefined || env.STRIPE_SECRET_KEY.length === 0) {
    throw new Error('KMG-PAY-STRIPE-CONFIG');
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
}

export function requireStripeWebhookSecret(): string {
  if (env.STRIPE_WEBHOOK_SECRET === undefined || env.STRIPE_WEBHOOK_SECRET.length === 0) {
    throw new Error('KMG-PAY-STRIPE-CONFIG');
  }

  return env.STRIPE_WEBHOOK_SECRET;
}
