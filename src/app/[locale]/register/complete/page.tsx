import { getTranslations } from 'next-intl/server';

import { CompleteRegistrationClient } from '@/features/registration/components/CompleteRegistrationClient';

type RegisterCompletePageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

export default async function RegisterCompletePage({ params }: RegisterCompletePageProps) {
  const t = await getTranslations('memberRegistration.complete');

  return (
    <main className="min-h-screen bg-page px-6 py-10 text-body">
      <section className="mx-auto grid max-w-3xl gap-6">
        <p className="text-xs font-semibold uppercase text-muted">{t('badge')}</p>
        <CompleteRegistrationClient locale={params.locale} />
      </section>
    </main>
  );
}
