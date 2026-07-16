import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env/server-env';

import 'server-only';

export function createSupabaseAdminClient() {
  // CV-DB-04: service role is reserved for system operations that must bypass RLS.
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
