import { type NextRequest,NextResponse } from 'next/server';

import { type Locale,routing } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNextPath(nextPath: string | null, locale: Locale): string {
  if (nextPath === null || !nextPath.startsWith(`/${locale}/`)) {
    return `/${locale}/dashboard`;
  }

  return nextPath;
}

export async function GET(request: NextRequest, { params }: { params: { locale: Locale } }) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextPath = safeNextPath(requestUrl.searchParams.get('next'), params.locale);

  if (!routing.locales.includes(params.locale) || code === null) {
    return NextResponse.redirect(new URL(`/${routing.defaultLocale}/auth/login`, request.url));
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    return NextResponse.redirect(new URL(`/${params.locale}/auth/login`, request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}