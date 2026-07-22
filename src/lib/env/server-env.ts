import { z } from 'zod';

import { publicEnv } from '@/lib/env/public-env';

import 'server-only';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_EVIDENCE_BUCKET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1),
  SIN_ENCRYPTION_KEY: z.string().regex(/^[\da-f]{64}$/i, 'SIN_ENCRYPTION_KEY must be a 32-byte hex string.'),
  CRON_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SUPABASE_WEBHOOK_SECRET: z.string().optional(),
  GEOCODING_PROVIDER: z.enum(['mapbox', 'nominatim']).optional(),
  MAPBOX_GEOCODING_TOKEN: z.string().optional(),
  GEOCODING_USER_AGENT: z.string().optional(),
  REQ_REGISTRY_DATA_URL: z.string().url().optional(),
  FEDERAL_REGISTRY_DATA_URL: z.string().url().optional()
});

const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_EVIDENCE_BUCKET: process.env.SUPABASE_STORAGE_EVIDENCE_BUCKET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  SIN_ENCRYPTION_KEY: process.env.SIN_ENCRYPTION_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  SUPABASE_WEBHOOK_SECRET: process.env.SUPABASE_WEBHOOK_SECRET,
  GEOCODING_PROVIDER: process.env.GEOCODING_PROVIDER,
  MAPBOX_GEOCODING_TOKEN: process.env.MAPBOX_GEOCODING_TOKEN,
  GEOCODING_USER_AGENT: process.env.GEOCODING_USER_AGENT,
  REQ_REGISTRY_DATA_URL: process.env.REQ_REGISTRY_DATA_URL,
  FEDERAL_REGISTRY_DATA_URL: process.env.FEDERAL_REGISTRY_DATA_URL
});

export const env = {
  ...publicEnv,
  ...serverEnv
} as const;
