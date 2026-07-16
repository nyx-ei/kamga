import { type NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const destroyedEvidenceSchema = z.object({
  storage_path: z.string()
});

function isAuthorized(request: NextRequest): boolean {
  if (env.CRON_SECRET === undefined || env.CRON_SECRET.length === 0) {
    return false;
  }

  return request.headers.get('authorization') === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ code: 'KMG-AUTH-403' }, { status: 403 });
  }

  const adminSupabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-07: cleanup is a system operation that removes private destroyed evidence objects.
  const { data, error } = await adminSupabase.from('evidence_uploads').select('storage_path').eq('status', 'destroyed');

  if (error || data === null) {
    return NextResponse.json({ code: 'KMG-SYS-000' }, { status: 500 });
  }

  const storagePaths = data.flatMap((row: unknown) => {
    const parsed = destroyedEvidenceSchema.safeParse(row);
    return parsed.success ? [parsed.data.storage_path] : [];
  });

  if (storagePaths.length === 0) {
    return NextResponse.json({ removed: 0 });
  }

  const { data: removed, error: removeError } = await adminSupabase.storage.from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET).remove(storagePaths);

  if (removeError) {
    return NextResponse.json({ code: 'KMG-SYS-000' }, { status: 500 });
  }

  return NextResponse.json({ removed: removed?.length ?? 0 });
}
