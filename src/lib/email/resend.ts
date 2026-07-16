import { Resend } from 'resend';

import { env } from '@/lib/env/server-env';

import 'server-only';

export const resend = new Resend(env.RESEND_API_KEY);

export const emailDefaults = {
  from: env.RESEND_FROM_EMAIL
} as const;
