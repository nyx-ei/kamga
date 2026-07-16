import { useTranslations } from 'next-intl';
import { Building2, Search } from 'lucide-react';

import { Link } from '@/i18n/navigation';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-5xl flex-col gap-8 rounded-md border border-border bg-card p-8 shadow-card">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
            <p className="text-base leading-7 text-secondary">{t('description')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
            href="/"
          >
            <Search aria-hidden="true" size={16} />
            {t('primaryAction')}
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            href="/register"
          >
            <Building2 aria-hidden="true" size={16} />
            {t('secondaryAction')}
          </Link>
        </div>
      </section>
    </main>
  );
}
