import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import 'server-only';

export type ConnectRequestCleanupResult = {
  processed: number;
};

export async function anonymizeExpiredConnectRequests(limit = 100): Promise<ConnectRequestCleanupResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('anonymize_expired_connect_requests', { limit_value: limit });

  if (error || data === null) {
    return { processed: 0 };
  }

  const first = Array.isArray(data) ? data[0] : data;
  const processed = typeof first?.processed === 'number' ? first.processed : 0;

  return { processed };
}
