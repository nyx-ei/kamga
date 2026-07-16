import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

import { type Locale, routing } from '@/i18n/routing';
import { publicEnv } from '@/lib/env/public-env';

const handleI18nRouting = createMiddleware(routing);
const localeSet = new Set<string>(routing.locales);

function localeFromPath(pathname: string): Locale {
  const firstSegment = pathname.split('/')[1];

  if (firstSegment !== undefined && localeSet.has(firstSegment)) {
    return firstSegment as Locale;
  }

  return routing.defaultLocale;
}

function pathWithoutLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment !== undefined && localeSet.has(firstSegment)) {
    const rest = segments.slice(1).join('/');
    return rest.length > 0 ? `/${rest}` : '/';
  }

  return pathname;
}

function isPublicPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/register' || pathname.startsWith('/auth/');
}

function localizedPath(locale: Locale, pathname: string): string {
  return `/${locale}${pathname === '/' ? '' : pathname}`;
}

export default async function middleware(request: NextRequest) {
  let response = handleI18nRouting(request);
  const locale = localeFromPath(request.nextUrl.pathname);
  const protectedPath = pathWithoutLocale(request.nextUrl.pathname);

  const supabase = createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response.cookies.set({ name, value: '', ...options });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (isPublicPath(protectedPath)) {
    return response;
  }

  if (protectedPath.startsWith('/dashboard') && user === null) {
    const loginUrl = new URL(localizedPath(locale, '/auth/login'), request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (protectedPath.startsWith('/admin')) {
    if (user === null) {
      const loginUrl = new URL(localizedPath(locale, '/auth/login'), request.url);
      loginUrl.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: isPlatformAdmin, error: roleError } = await supabase.rpc('has_role', {
      required_role: 'platform_admin'
    });

    if (roleError || isPlatformAdmin !== true) {
      return NextResponse.redirect(new URL(localizedPath(locale, '/dashboard'), request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
