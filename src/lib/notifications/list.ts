import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import 'server-only';

export type UserNotification = {
  body: string;
  createdAt: string;
  href: string | null;
  id: string;
  isRead: boolean;
  title: string;
};

const notificationRowSchema = z.object({
  body: z.string(),
  created_at: z.string(),
  href: z.string().nullable(),
  id: z.string().uuid(),
  read_at: z.string().nullable(),
  title: z.string()
});

export async function listUserNotifications(limit = 8): Promise<UserNotification[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from('notifications').select('id,title,body,href,read_at,created_at').order('created_at', { ascending: false }).limit(limit);

  if (error || data === null) {
    return [];
  }

  return data.flatMap((row: unknown) => {
    const parsed = notificationRowSchema.safeParse(row);

    if (!parsed.success) {
      return [];
    }

    return [
      {
        body: parsed.data.body,
        createdAt: parsed.data.created_at,
        href: parsed.data.href,
        id: parsed.data.id,
        isRead: parsed.data.read_at !== null,
        title: parsed.data.title
      }
    ];
  });
}
