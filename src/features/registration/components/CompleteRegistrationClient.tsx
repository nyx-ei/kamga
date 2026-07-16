'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { completeRegistration } from '@/features/registration/actions';
import { MEMBER_REGISTRATION_STORAGE_KEY, type MemberRegistrationActionCode, type StoredMemberRegistration } from '@/features/registration/registration-types';
import { useRouter } from '@/i18n/navigation';

type CompleteRegistrationClientProps = {
  locale: 'en' | 'fr';
};

type CompletionState = 'loading' | 'error';

export function CompleteRegistrationClient({ locale }: CompleteRegistrationClientProps) {
  const t = useTranslations('memberRegistration.complete');
  const router = useRouter();
  const [state, setState] = useState<CompletionState>('loading');
  const [code, setCode] = useState<MemberRegistrationActionCode | 'KMG-RG-001' | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function finishRegistration() {
      const stored = sessionStorage.getItem(MEMBER_REGISTRATION_STORAGE_KEY);

      if (stored === null) {
        if (isMounted) {
          setCode('KMG-RG-001');
          setState('error');
        }
        return;
      }

      let registration: StoredMemberRegistration;

      try {
        registration = JSON.parse(stored) as StoredMemberRegistration;
      } catch {
        if (isMounted) {
          setCode('KMG-RG-001');
          setState('error');
        }
        return;
      }

      const result = await completeRegistration({ ...registration, locale });

      if (result.ok) {
        sessionStorage.removeItem(MEMBER_REGISTRATION_STORAGE_KEY);
        router.replace({ pathname: '/dashboard', query: { registration: 'pending' } });
        return;
      }

      if (isMounted) {
        setCode(result.code);
        setState('error');
      }
    }

    void finishRegistration();

    return () => {
      isMounted = false;
    };
  }, [locale, router]);

  return (
    <div className="grid gap-4 rounded-md border border-border bg-card p-8 shadow-card">
      {state === 'loading' ? (
        <div className="flex items-start gap-3">
          <Loader2 aria-hidden="true" className="mt-1 animate-spin text-muted" size={20} />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-heading">{t('title')}</h1>
            <p className="text-sm leading-6 text-secondary">{t('description')}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">
          {t(`errors.${code ?? 'KMG-RG-001'}`)} ({code ?? 'KMG-RG-001'})
        </p>
      )}
    </div>
  );
}
