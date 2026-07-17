import { useTranslations } from 'next-intl';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

import { PublicDirectoryHeader } from '@/components/kamga/MockupShell';
import { LoginForm } from '@/features/auth';

type LoginPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    next?: string;
  };
};

export default function LoginPage({ params, searchParams }: LoginPageProps) {
  const t = useTranslations('auth.login');

  return (
    <main className="min-h-screen bg-page text-body">
      <PublicDirectoryHeader locale={params.locale} />
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[0.95fr_1fr] lg:items-start">
        <div className="rounded-md border border-border bg-card p-8 shadow-card">
          <span className="grid size-14 place-items-center rounded-md bg-[#f1f4ff] text-[#3454b8]">
            <LockKeyhole aria-hidden="true" size={28} />
          </span>
          <p className="mt-8 text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-heading">{t('title')}</h1>
          <p className="mt-5 text-base leading-7 text-secondary">{t('description')}</p>
          <div className="mt-8 grid gap-3 rounded-sm border border-border bg-sunken p-5 text-sm leading-6 text-secondary">
            <p className="inline-flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-1 shrink-0 text-positive" size={18} />
              <span>{t('securityNote')}</span>
            </p>
          </div>
        </div>
        <section className="rounded-md border border-border bg-card p-8 shadow-card">
          <LoginForm nextPath={searchParams.next} />
        </section>
      </section>
    </main>
  );
}
