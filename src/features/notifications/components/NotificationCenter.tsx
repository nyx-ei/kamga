'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Check } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { markAllNotificationsRead, markNotificationRead } from '@/features/notifications/actions';
import type { NotificationActionState } from '@/features/notifications/notification-types';

type NotificationItem = {
  body: string;
  createdAtLabel: string;
  href: string | null;
  id: string;
  isRead: boolean;
  title: string;
};

type NotificationCenterProps = {
  notifications: NotificationItem[];
  unreadCount: number;
};

const initialState: NotificationActionState = { ok: true };

function ReadButton() {
  const t = useTranslations('notifications');
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={t('markReadAction')}
      className="inline-flex size-8 items-center justify-center rounded-sm border border-border bg-card text-heading shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Check aria-hidden="true" size={15} />
    </button>
  );
}

function MarkReadForm({ notificationId }: { notificationId: string }) {
  const [state, action] = useFormState(markNotificationRead, initialState);

  return (
    <form action={action}>
      <input name="notificationId" type="hidden" value={notificationId} />
      <ReadButton />
      {state.ok ? null : <span className="sr-only">{state.code}</span>}
    </form>
  );
}

function MarkAllReadForm() {
  const t = useTranslations('notifications');
  const [state, action] = useFormState(markAllNotificationsRead, initialState);

  return (
    <form action={action}>
      <button className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-heading shadow-card transition hover:border-border-strong" type="submit">
        <Check aria-hidden="true" size={16} />
        {t('markAllReadAction')}
      </button>
      {state.ok ? null : <span className="sr-only">{state.code}</span>}
    </form>
  );
}

function PushNotificationOptIn() {
  const t = useTranslations('notifications');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);
  }, []);

  async function requestPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);

    if (nextPermission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({
        body: t('pushTestBody'),
        tag: 'kamga-push-enabled',
        title: t('pushTestTitle'),
        type: 'SHOW_NOTIFICATION',
        url: window.location.pathname
      });
    }
  }

  if (permission === 'unsupported') {
    return (
      <p className="rounded-sm border border-border bg-sunken px-3 py-2 text-sm text-secondary">
        {t('pushUnsupported')}
      </p>
    );
  }

  if (permission === 'granted') {
    return (
      <p className="rounded-sm border border-border bg-positive-bg px-3 py-2 text-sm font-medium text-positive">
        {t('pushEnabled')}
      </p>
    );
  }

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-heading shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
      disabled={permission === 'denied'}
      onClick={requestPermission}
      type="button"
    >
      <Bell aria-hidden="true" size={16} />
      {permission === 'denied' ? t('pushDenied') : t('pushEnableAction')}
    </button>
  );
}

export function NotificationCenter({ notifications, unreadCount }: NotificationCenterProps) {
  const t = useTranslations('notifications');

  return (
    <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-heading">
            <Bell aria-hidden="true" size={18} />
            {t('title')}
          </h2>
          <p className="text-sm leading-6 text-secondary">{t('description', { count: unreadCount })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PushNotificationOptIn />
          {unreadCount === 0 ? null : <MarkAllReadForm />}
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyState')}</p>
      ) : (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <article className="grid gap-3 rounded-sm border border-border bg-card p-4 md:grid-cols-[1fr_auto]" key={notification.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {notification.isRead ? null : <span className="size-2 rounded-full bg-brand" />}
                  <h3 className="font-semibold text-heading">{notification.title}</h3>
                  <p className="text-xs text-muted">{notification.createdAtLabel}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-secondary">{notification.body}</p>
                {notification.href === null ? null : (
                  <a className="mt-3 inline-flex text-sm font-medium text-heading underline-offset-4 hover:underline" href={notification.href}>
                    {t('openAction')}
                  </a>
                )}
              </div>
              {notification.isRead ? null : <MarkReadForm notificationId={notification.id} />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
