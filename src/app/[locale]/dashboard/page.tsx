import { redirect } from 'next/navigation';

import type { Locale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';

type DashboardPageProps = {
  params: {
    locale: Locale;
  };
  searchParams: Record<string, string | string[] | undefined>;
};

function queryString(searchParams: DashboardPageProps['searchParams']): string {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  });

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const currentUser = await requireUser();

  if (currentUser.role === 'platform_admin') {
    redirect(`/${params.locale}/admin`);
  }

  redirect(`/${params.locale}/dashboard/applications${queryString(searchParams)}`);
}
