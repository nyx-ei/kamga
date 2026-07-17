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

  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5">
      <Link className={`rounded-full px-4 py-2 text-sm font-semibold ${locale === 'en' ? 'bg-blue-900 text-white' : 'text-secondary'}`} href={href} locale="en">
        EN
      </Link>
      <Link className={`rounded-full px-4 py-2 text-sm font-semibold ${locale === 'fr' ? 'bg-blue-900 text-white' : 'text-secondary'}`} href={href} locale="fr">
        FR
      </Link>
    </div>
  );
}
