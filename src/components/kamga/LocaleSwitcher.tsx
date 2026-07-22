'use client';

import { useSearchParams } from 'next/navigation';

import { Link, usePathname } from '@/i18n/navigation';

type LocaleSwitcherProps = {
  locale: 'en' | 'fr';
};

export function LocaleSwitcher({ locale }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const href = queryString.length > 0 ? `${pathname}?${queryString}` : pathname;
  const persistLocale = (nextLocale: 'en' | 'fr') => {
    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5">
      <Link className={`rounded-full px-4 py-2 text-sm font-semibold ${locale === 'en' ? 'bg-blue-900 text-white' : 'text-secondary'}`} href={href} locale="en" onClick={() => persistLocale('en')}>
        EN
      </Link>
      <Link className={`rounded-full px-4 py-2 text-sm font-semibold ${locale === 'fr' ? 'bg-blue-900 text-white' : 'text-secondary'}`} href={href} locale="fr" onClick={() => persistLocale('fr')}>
        FR
      </Link>
    </div>
  );
}
