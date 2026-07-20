import { getFormatter, getTranslations } from 'next-intl/server';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { NotificationCenter } from '@/features/notifications';
import { requirePlatformAdmin } from '@/lib/auth';
import { listUserNotifications } from '@/lib/notifications/list';

type AdminNotificationsPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

export default async function AdminNotificationsPage({ params }: AdminNotificationsPageProps) {
  const currentUser = await requirePlatformAdmin();
  const t = await getTranslations('notifications');
  const format = await getFormatter();
  const notifications = await listUserNotifications();

  return (
    <AdminWorkspaceShell activeItem="notifications" locale={params.locale} title={t('title')} userEmail={currentUser.user.email}>
      <section className="max-w-5xl">
        <NotificationCenter
          notifications={notifications.map((notification) => ({
            ...notification,
            createdAtLabel: format.dateTime(new Date(notification.createdAt), { dateStyle: 'medium', timeStyle: 'short' })
          }))}
          unreadCount={notifications.filter((notification) => !notification.isRead).length}
        />
      </section>
    </AdminWorkspaceShell>
  );
}
