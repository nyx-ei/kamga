'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';

import { revealSIN } from '@/features/memberships/actions';
import type { MembershipActionCode } from '@/features/memberships/membership-types';

type SINRevealProps = {
  membershipId: string;
};

const SIN_MASK = '***-***-***';
const REVEAL_TIMEOUT_MS = 30_000;

function formatSIN(sin: string): string {
  return sin.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1-$2-$3');
}

export function SINReveal({ membershipId }: SINRevealProps) {
  const t = useTranslations('memberships.admin');
  const [isPending, startTransition] = useTransition();
  const [revealedSIN, setRevealedSIN] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<MembershipActionCode | null>(null);

  useEffect(() => {
    if (revealedSIN === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRevealedSIN(null);
    }, REVEAL_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [revealedSIN]);

  function handleReveal() {
    startTransition(async () => {
      setErrorCode(null);
      const result = await revealSIN(membershipId);

      if (!result.ok) {
        setRevealedSIN(null);
        setErrorCode(result.code);
        return;
      }

      setRevealedSIN(formatSIN(result.sin));
    });
  }

  function handleMask() {
    setRevealedSIN(null);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-sm border border-border bg-card px-3 py-2 font-mono text-sm text-heading">{revealedSIN ?? SIN_MASK}</code>
        {revealedSIN === null ? (
          <button
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isPending}
            onClick={handleReveal}
            type="button"
          >
            <Eye aria-hidden="true" size={16} />
            {isPending ? t('sinRevealing') : t('sinRevealAction')}
          </button>
        ) : (
          <button
            className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
            onClick={handleMask}
            type="button"
          >
            <EyeOff aria-hidden="true" size={16} />
            {t('sinMaskAction')}
          </button>
        )}
      </div>
      {revealedSIN === null ? <p className="text-xs text-muted">{t('sinMaskedHelp')}</p> : <p className="text-xs text-warning">{t('sinRevealedHelp')}</p>}
      {errorCode === null ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${errorCode}`)} ({errorCode})
        </p>
      )}
    </div>
  );
}
