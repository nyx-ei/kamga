import { getTranslations } from 'next-intl/server';
import { Building2, LogIn } from 'lucide-react';

import { AssociationRegistrationForm } from '@/features/associations/components/AssociationRegistrationForm';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth';

type RegisterPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const t = await getTranslations('associations.registration');
  const currentUser = await getCurrentUser();

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto grid max-w-5xl gap-8 rounded-md border border-border bg-card p-8 shadow-card lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
            <p className="text-base leading-7 text-secondary">{t('description')}</p>
          </div>
          <div className="rounded-sm border border-border bg-sunken p-4 text-sm leading-6 text-secondary">
            {t('reviewNotice')}
          </div>
        </div>

        {currentUser === null ? (
          <div className="flex flex-col justify-center gap-4 rounded-md border border-border bg-sunken p-6">
            <Building2 aria-hidden="true" className="text-muted" size={28} />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-heading">{t('authRequiredTitle')}</h2>
              <p className="text-sm leading-6 text-secondary">{t('authRequiredDescription')}</p>
            </div>
            <Link
              className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
              href={{ pathname: '/auth/login', query: { next: `/${params.locale}/register` } }}
            >
              <LogIn aria-hidden="true" size={16} />
              {t('authRequiredAction')}
            </Link>
          </div>
        ) : (
          <AssociationRegistrationForm locale={params.locale} />
        )}
      </section>
    </main>
  );
}

