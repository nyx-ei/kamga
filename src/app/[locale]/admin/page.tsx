import { useTranslations } from 'next-intl';
import { ClipboardList, HandCoins, Link2, UsersRound } from 'lucide-react';

import { LogoutButton } from '@/features/auth';
import { Link } from '@/i18n/navigation';

export default function AdminPage() {
  const t = useTranslations('admin');

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-4xl flex-col gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
          <p className="text-base leading-7 text-secondary">{t('description')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
            href="/admin/associations"
          >
            <ClipboardList aria-hidden="true" size={16} />
            {t('associationReviewAction')}
          </Link>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/admin/referrals"
          >
            <Link2 aria-hidden="true" size={16} />
            {t('referralsAction')}
          </Link>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/admin/members"
          >
            <UsersRound aria-hidden="true" size={16} />
            {t('membersAction')}
          </Link>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/admin/levees"
          >
            <HandCoins aria-hidden="true" size={16} />
            {t('leveesAction')}
          </Link>
          <LogoutButton className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong" />
        </div>
      </section>
    </main>
  );
}
