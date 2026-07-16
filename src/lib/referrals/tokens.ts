/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import { nanoid } from 'nanoid';
import { z } from 'zod';

import type { Locale } from '@/i18n/routing';
import { publicEnv } from '@/lib/env/public-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const REFERRAL_TOKEN_SIZE = 21;
export const REFERRAL_TOKEN_TTL_DAYS = 30;

export type ReferralTokenValidationCode = 'KMG-REF-001' | 'KMG-REF-002' | 'KMG-REF-003' | 'KMG-REF-004' | 'KMG-SYS-000';

export type ReferralTokenValidationResult =
  | {
      ok: true;
      token: string;
      associationId: string;
      associationName: string;
      expiresAt: string;
    }
  | {
      ok: false;
      code: ReferralTokenValidationCode;
    };

export type ReferralTokenConsumptionResult =
  | {
      ok: true;
      associationId: string;
      referralTokenId: string;
    }
  | {
      ok: false;
      code: 'KMG-AUTH-401' | 'KMG-REF-004' | 'KMG-SYS-000';
    };

const referralTokenSchema = z.string().trim().length(REFERRAL_TOKEN_SIZE);

const referralTokenRowSchema = z.object({
  id: z.string().uuid(),
  token: z.string(),
  expires_at: z.string(),
  used_by: z.string().uuid().nullable(),
  association_id: z.string().uuid(),
  associations: z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum(['pending_review', 'active', 'declined', 'suspended'])
  })
});

const consumedReferralSchema = z.object({
  referral_token_id: z.string().uuid(),
  association_id: z.string().uuid()
});

export function generateReferralToken(): string {
  return nanoid(REFERRAL_TOKEN_SIZE);
}

export function buildReferralUrl(locale: Locale, token: string): string {
  const url = new URL(`/${locale}/register`, publicEnv.NEXT_PUBLIC_APP_URL);
  url.searchParams.set('ref', token);
  return url.toString();
}

export function parseReferralToken(token: string): { ok: true; token: string } | { ok: false; code: 'KMG-REF-001' } {
  const parsed = referralTokenSchema.safeParse(token);

  if (!parsed.success) {
    return { ok: false, code: 'KMG-REF-001' };
  }

  return { ok: true, token: parsed.data };
}

export async function validateReferralToken(token: string): Promise<ReferralTokenValidationResult> {
  const parsedToken = parseReferralToken(token);

  if (!parsedToken.ok) {
    return parsedToken;
  }

  const supabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-06: public referral validation exposes only the association summary needed for registration gating.
  const { data, error } = await supabase
    .from('referral_tokens')
    .select('id,token,expires_at,used_by,association_id,associations!inner(id,name,status)')
    .eq('token', parsedToken.token)
    .maybeSingle();

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  if (data === null) {
    return { ok: false, code: 'KMG-REF-002' };
  }

  const parsedRow = referralTokenRowSchema.safeParse(data);

  if (!parsedRow.success) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  if (parsedRow.data.used_by !== null) {
    return { ok: false, code: 'KMG-REF-004' };
  }

  if (new Date(parsedRow.data.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: 'KMG-REF-003' };
  }

  if (parsedRow.data.associations.status !== 'active') {
    return { ok: false, code: 'KMG-REF-002' };
  }

  return {
    ok: true,
    token: parsedRow.data.token,
    associationId: parsedRow.data.association_id,
    associationName: parsedRow.data.associations.name,
    expiresAt: parsedRow.data.expires_at
  };
}

export async function consumeReferralToken(token: string): Promise<ReferralTokenConsumptionResult> {
  const parsedToken = parseReferralToken(token);

  if (!parsedToken.ok) {
    return { ok: false, code: 'KMG-REF-004' };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('consume_referral_token', { token_value: parsedToken.token });

  if (error) {
    if (error.message === 'KMG-AUTH-401') {
      return { ok: false, code: 'KMG-AUTH-401' };
    }

    if (error.message === 'KMG-REF-004') {
      return { ok: false, code: 'KMG-REF-004' };
    }

    return { ok: false, code: 'KMG-SYS-000' };
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  const parsedRow = consumedReferralSchema.safeParse(firstRow);

  if (!parsedRow.success) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  return {
    ok: true,
    associationId: parsedRow.data.association_id,
    referralTokenId: parsedRow.data.referral_token_id
  };
}

