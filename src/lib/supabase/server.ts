import { cookies } from 'next/headers';
import { type CookieOptions,createServerClient } from '@supabase/ssr';

import { publicEnv } from '@/lib/env/public-env';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options });
      }
    }
  });
}
