import { useTranslations } from 'next-intl';

import { LoginForm } from '@/features/auth';

type LoginPageProps = {
  searchParams: {
    next?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const t = useTranslations('auth.login');

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
          <h1 className="text-3xl font-semibold leading-tight text-heading">{t('title')}</h1>
          <p className="text-base leading-7 text-secondary">{t('description')}</p>
        </div>
        <LoginForm nextPath={searchParams.next} />
      </section>
    </main>
  );
}