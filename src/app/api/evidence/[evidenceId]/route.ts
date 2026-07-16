import { type NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { env } from '@/lib/env/server-env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const routeParamsSchema = z.object({
  evidenceId: z.string().uuid()
});

const evidenceRowSchema = z.object({
  evidence_type: z.string(),
  id: z.string().uuid(),
  status: z.enum(['pending', 'uploaded', 'destroyed']),
  storage_path: z.string(),
  association_members: z
    .object({
      association_id: z.string().uuid()
    })
    .nullable()
});

function inlineFilename(evidenceType: string, contentType: string | null): string {
  const extension = contentType === 'application/pdf' ? 'pdf' : contentType === 'image/png' ? 'png' : 'jpg';
  return `${evidenceType}.${extension}`;
}

function evidenceResponse(body: ArrayBuffer, contentType: string | null, evidenceType: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="${inlineFilename(evidenceType, contentType)}"`,
      'Content-Type': contentType ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function GET(_request: NextRequest, { params }: { params: { evidenceId: string } }) {
  const parsedParams = routeParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ code: 'KMG-RG-001' }, { status: 400 });
  }

  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    return NextResponse.json({ code: 'KMG-AUTH-401' }, { status: 401 });
  }

  const adminSupabase = createSupabaseAdminClient();
  // CV-DB-04 / CV-SEC-07: service role locates private evidence before the user's authorization is checked below.
  const { data, error } = await adminSupabase
    .from('evidence_uploads')
    .select('id,evidence_type,status,storage_path,association_members!inner(association_id)')
    .eq('id', parsedParams.data.evidenceId)
    .maybeSingle();

  if (error || data === null) {
    return NextResponse.json({ code: 'KMG-RG-404' }, { status: 404 });
  }

  const parsedEvidence = evidenceRowSchema.safeParse(data);

  if (!parsedEvidence.success || parsedEvidence.data.association_members === null || parsedEvidence.data.status === 'destroyed') {
    return NextResponse.json({ code: 'KMG-RG-404' }, { status: 404 });
  }

  if (currentUser.role !== 'platform_admin') {
    const supabase = createSupabaseServerClient();
    const { data: isAssociationAdmin, error: roleError } = await supabase.rpc('is_association_admin', {
      association_uuid: parsedEvidence.data.association_members.association_id
    });

    if (roleError || isAssociationAdmin !== true) {
      return NextResponse.json({ code: 'KMG-AUTH-403' }, { status: 403 });
    }
  }

  const { data: signedUrlData, error: signedUrlError } = await adminSupabase.storage
    .from(env.SUPABASE_STORAGE_EVIDENCE_BUCKET)
    .createSignedUrl(parsedEvidence.data.storage_path, 60);

  if (signedUrlError || signedUrlData?.signedUrl === undefined) {
    return NextResponse.json({ code: 'KMG-SYS-000' }, { status: 500 });
  }

  const storageResponse = await fetch(signedUrlData.signedUrl, { cache: 'no-store' });

  if (!storageResponse.ok) {
    return NextResponse.json({ code: 'KMG-RG-404' }, { status: 404 });
  }

  return evidenceResponse(await storageResponse.arrayBuffer(), storageResponse.headers.get('content-type'), parsedEvidence.data.evidence_type);
}
