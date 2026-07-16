import { getTranslations } from 'next-intl/server';
import { Building2 } from 'lucide-react';

import { LogoutButton } from '@/features/auth';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';

type DashboardPageProps = {
  searchParams: {
    associationSubmitted?: string;
  };
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentUser = await requireUser();
  const t = await getTranslations('dashboard');

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-4xl flex-col gap-6 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
          <p className="text-base leading-7 text-secondary">{t('description')}</p>
        </div>
        {searchParams.associationSubmitted === '1' ? (
          <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">
            {t('associationSubmitted')}
          </p>
        ) : null}
        <dl className="rounded-sm border border-border bg-sunken p-4">
          <dt className="text-sm font-medium text-secondary">{t('roleLabel')}</dt>
          <dd className="mt-1 font-mono text-sm text-heading">{currentUser.role ?? t('unknownRole')}</dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
            href="/register"
          >
            <Building2 aria-hidden="true" size={16} />
            {t('registerAssociationAction')}
          </Link>
          <LogoutButton className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong" />
        </div>
      </section>
    </main>
  );
}
