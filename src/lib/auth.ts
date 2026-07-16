import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const APP_ROLES = ['platform_admin', 'association_admin', 'member'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type CurrentUser = {
  user: User;
  role: AppRole | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || user === null) {
    return null;
  }

  const { data: roleRow, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();

  if (roleError) {
    return { user, role: null };
  }

  return { user, role: roleRow?.role ?? null };
}

export async function requireUser(): Promise<CurrentUser> {
  const currentUser = await getCurrentUser();

  if (currentUser === null) {
    redirect('/auth/login');
  }

  return currentUser;
}

export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const currentUser = await requireUser();

  if (currentUser.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return currentUser;
}
