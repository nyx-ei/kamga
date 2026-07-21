import { getTranslations } from 'next-intl/server';
import { WifiOff } from 'lucide-react';

import { PublicDirectoryHeader } from '@/components/kamga/MockupShell';
import { Link } from '@/i18n/navigation';

type OfflinePageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

export default async function OfflinePage({ params }: OfflinePageProps) {
  const t = await getTranslations('pwa.offline');

  return (
    <main className="min-h-screen bg-page text-body">
      <PublicDirectoryHeader locale={params.locale} />
      <section className="mx-auto grid max-w-3xl gap-6 px-6 py-16">
        <div className="rounded-md border border-border bg-card p-6 shadow-card">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-brand-faint text-brand-strong">
              <WifiOff aria-hidden="true" size={24} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
              <h1 className="mt-2 text-3xl font-semibold text-heading">{t('title')}</h1>
              <p className="mt-3 text-base leading-7 text-secondary">{t('description')}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="inline-flex rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong" href="/dashboard/contributions">
                  {t('contributionsAction')}
                </Link>
                <Link className="inline-flex rounded-sm border border-border bg-card px-4 py-2 text-sm font-semibold text-heading shadow-card transition hover:border-border-strong" href="/">
                  {t('directoryAction')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
