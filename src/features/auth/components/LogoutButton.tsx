'use client';

import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';

import { useRouter } from '@/i18n/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const t = useTranslations('auth.logout');
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <button className={className} onClick={() => void handleLogout()} type="button">
      <LogOut aria-hidden="true" size={16} />
      {t('action')}
    </button>
  );
}