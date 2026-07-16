import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { ServiceWorkerRegistration } from '@/components/ui/ServiceWorkerRegistration';
import { type Locale } from '@/i18n/routing';

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: { locale: Locale };
}>) {
  const messages = await getMessages();

  return (
    <html lang={params.locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
          <ServiceWorkerRegistration />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}