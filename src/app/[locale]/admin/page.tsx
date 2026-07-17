import { getFormatter, getTranslations } from 'next-intl/server';
import { Check, ClipboardList, FileUp, HandCoins, Link2, Upload, UsersRound } from 'lucide-react';

import { AdminWorkspaceShell } from '@/components/kamga/MockupShell';
import { LogoutButton } from '@/features/auth';
import { NotificationCenter } from '@/features/notifications';
import { Link } from '@/i18n/navigation';
import { listUserNotifications } from '@/lib/notifications/list';

export default async function AdminPage() {
  const t = await getTranslations('admin');
  const format = await getFormatter();
  const notifications = await listUserNotifications();

  return (
    <AdminWorkspaceShell
      activeItem="csv"
      activeTab="csv"
      title="CSV import"
      toolbar={
        <div className="flex items-center gap-4">
          <span className="text-sm text-secondary">
            Seeding <strong className="text-heading">63/100</strong>
          </span>
          <Link
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:border-border-strong"
            href="/admin/associations"
          >
            <FileUp aria-hidden="true" size={16} />
            Import CSV
          </Link>
        </div>
      }
    >
      <section className="grid gap-8">
        <div className="grid min-h-[315px] place-items-center rounded-md border border-dashed border-brand bg-sunken p-10 text-center">
          <div>
            <Upload aria-hidden="true" className="mx-auto text-[#4d67c7]" size={46} />
            <h2 className="mt-6 text-2xl font-semibold text-heading">Drop a CSV, or browse</h2>
            <p className="mt-3 text-sm leading-6 text-secondary">Same schema as the entry form. Postal codes are geocoded on import.</p>
            <div className="mt-6 flex justify-center gap-4">
              <button className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card" type="button">
                <FileUp aria-hidden="true" size={16} />
                Choose file
              </button>
              <button className="inline-flex items-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold text-brand" type="button">
                Download template
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-heading">Preview - associations_qc.csv</h2>
              <span className="rounded-full bg-positive-bg px-3 py-1 text-xs font-semibold text-positive">3 ready</span>
              <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">1 needs a postal code</span>
            </div>
            <button className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-2 text-sm font-semibold text-heading shadow-card" type="button">
              <Check aria-hidden="true" size={16} />
              Import 3 rows
            </button>
          </div>
          {[
            ['Association RPN Quebec-Centre', 'Quebec', '1163002991', 'ready'],
            ['Entraide Saguenay', 'Saguenay', '1178220043', 'ready'],
            ['Reseau Cote-Nord', 'Sept-Iles', '-', 'warning'],
            ['RPN Outaouais', 'Gatineau', '1170554820', 'ready']
          ].map(([name, city, number, status]) => (
            <div className="grid grid-cols-[48px_1fr_220px_220px] items-center border-b border-border px-6 py-4 last:border-b-0" key={name}>
              <span className={status === 'ready' ? 'text-positive' : 'text-warning'}>{status === 'ready' ? 'OK' : '!'}</span>
              <span className="font-medium text-heading">{name}</span>
              <span className="text-secondary">{city}</span>
              <span className="font-mono text-secondary">{number}</span>
            </div>
          ))}
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
