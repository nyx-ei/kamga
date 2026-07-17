import { getFormatter, getTranslations } from 'next-intl/server';
import { ClipboardList, FileUp, HandCoins, Link2, Upload, UsersRound } from 'lucide-react';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { LogoutButton } from '@/features/auth';
import { NotificationCenter } from '@/features/notifications';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listUserNotifications } from '@/lib/notifications/list';

export default async function AdminPage() {
  const t = await getTranslations('admin');
  const format = await getFormatter();
  const currentUser = await getCurrentUser();
  const notifications = await listUserNotifications();

  return (
    <AdminWorkspaceShell
      activeItem="csv"
      activeTab="csv"
      title="CSV import"
      userEmail={currentUser?.user.email}
      toolbar={
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">Not implemented yet</span>
          <button
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm border border-border bg-sunken px-4 py-2 text-sm font-semibold text-muted shadow-card"
            disabled
            type="button"
          >
            <FileUp aria-hidden="true" size={16} />
            Import CSV
          </button>
        </div>
      }
    >
      <section className="grid gap-8">
        <div className="grid min-h-[315px] place-items-center rounded-md border border-dashed border-brand bg-sunken p-10 text-center">
          <div>
            <Upload aria-hidden="true" className="mx-auto text-[#4d67c7]" size={46} />
            <h2 className="mt-6 text-2xl font-semibold text-heading">Drop a CSV, or browse</h2>
            <p className="mt-3 text-sm leading-6 text-secondary">CSV import will be connected when the import backend is implemented.</p>
            <div className="mt-6 flex justify-center gap-4">
              <button className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm bg-[#d8def5] px-5 py-3 text-sm font-semibold text-muted shadow-card" disabled type="button">
                <FileUp aria-hidden="true" size={16} />
                Choose file
              </button>
              <button className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold text-muted" disabled type="button">
                Download template
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-heading">Preview</h2>
              <span className="rounded-full bg-info-bg px-3 py-1 text-xs font-semibold text-info">No file selected</span>
            </div>
            <button className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm bg-[#d8def5] px-5 py-2 text-sm font-semibold text-muted shadow-card" disabled type="button">
              Import rows
            </button>
          </div>
          <div className="px-6 py-10 text-sm leading-6 text-secondary">No CSV data is displayed until a real import flow is implemented.</div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <NotificationCenter
            notifications={notifications.map((notification) => ({
              ...notification,
              createdAtLabel: format.dateTime(new Date(notification.createdAt), { dateStyle: 'medium', timeStyle: 'short' })
            }))}
            unreadCount={notifications.filter((notification) => !notification.isRead).length}
          />

          <aside className="rounded-md border border-border bg-card p-6 shadow-card">
            <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
            <h2 className="mt-2 text-2xl font-semibold text-heading">{t('title')}</h2>
            <p className="mt-3 text-sm leading-6 text-secondary">{t('description')}</p>
            <div className="mt-6 grid gap-3">
              <Link className="inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-3 text-sm font-semibold text-heading shadow-card" href="/admin/associations">
                <ClipboardList aria-hidden="true" size={16} />
                {t('associationReviewAction')}
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-3 text-sm font-semibold text-heading shadow-card" href="/admin/referrals">
                <Link2 aria-hidden="true" size={16} />
                {t('referralsAction')}
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-3 text-sm font-semibold text-heading shadow-card" href="/admin/members">
                <UsersRound aria-hidden="true" size={16} />
                {t('membersAction')}
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-3 text-sm font-semibold text-heading shadow-card" href="/admin/levees">
                <HandCoins aria-hidden="true" size={16} />
                {t('leveesAction')}
              </Link>
              <LogoutButton className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-3 text-sm font-semibold text-heading shadow-card" />
            </div>
          </aside>
        </div>
      </section>
    </AdminWorkspaceShell>
  );
}
