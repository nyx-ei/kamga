'use server';

import { revalidatePath } from 'next/cache';

import { type NotificationActionState, notificationIdSchema, paymentReminderSchema } from '@/features/notifications/notification-types';
import { requireUser } from '@/lib/auth';
import { notifyPaymentReminder } from '@/lib/notifications/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_STATE: NotificationActionState = { ok: true };

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function markNotificationRead(_previousState: NotificationActionState = INITIAL_STATE, formData: FormData): Promise<NotificationActionState> {
  const currentUser = await requireUser();
  const parsed = notificationIdSchema.safeParse({
    notificationId: valueFromFormData(formData, 'notificationId')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-NT-001' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.notificationId)
    .eq('recipient_user_id', currentUser.user.id);

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin');

  return { ok: true };
}

export async function markAllNotificationsRead(_previousState: NotificationActionState = INITIAL_STATE): Promise<NotificationActionState> {
  const currentUser = await requireUser();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', currentUser.user.id)
    .is('read_at', null);

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin');

  return { ok: true };
}

export async function sendPaymentReminder(_previousState: NotificationActionState = INITIAL_STATE, formData: FormData): Promise<NotificationActionState> {
  const currentUser = await requireUser();
  const parsed = paymentReminderSchema.safeParse({
    contributionId: valueFromFormData(formData, 'contributionId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-NT-001' };
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: contribution, error } = await adminSupabase
    .from('member_contributions')
    .select('association_levee_calls:association_levee_call_id(association_id)')
    .eq('id', parsed.data.contributionId)
    .maybeSingle();

  if (error || contribution === null) {
    return { ok: false, code: 'KMG-NT-001' };
  }

  const call = Array.isArray(contribution.association_levee_calls) ? contribution.association_levee_calls[0] : contribution.association_levee_calls;
  const associationId = typeof call?.association_id === 'string' ? call.association_id : null;

  if (associationId === null) {
    return { ok: false, code: 'KMG-NT-001' };
  }

  if (currentUser.role !== 'platform_admin') {
    const { data: adminMembership } = await adminSupabase
      .from('association_members')
      .select('id')
      .eq('association_id', associationId)
      .eq('user_id', currentUser.user.id)
      .eq('role', 'association_admin')
      .eq('status', 'active')
      .maybeSingle();

    if (adminMembership === null) {
      return { ok: false, code: 'KMG-AUTH-403' };
    }
  }

  const ok = await notifyPaymentReminder(parsed.data);

  if (!ok) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePath('/dashboard');
  revalidatePath(`/${parsed.data.locale}/dashboard`);
  revalidatePath('/admin/levees');
  revalidatePath(`/${parsed.data.locale}/admin/levees`);

  return { ok: true };
}
