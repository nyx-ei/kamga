'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type ContributionProgressRealtimeProps = {
  callIds: string[];
};

export function ContributionProgressRealtime({ callIds }: ContributionProgressRealtimeProps) {
  const router = useRouter();

  useEffect(() => {
    if (callIds.length === 0) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`member-contributions:${callIds.join(',')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_contributions'
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [callIds, router]);

  return null;
}
