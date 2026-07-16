'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';

type ReferralCopyButtonProps = {
  value: string;
};

export function ReferralCopyButton({ value }: ReferralCopyButtonProps) {
  const t = useTranslations('referrals.admin');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const Icon = copied ? Check : Copy;

  return (
    <button
      aria-label={copied ? t('copiedLabel') : t('copyLabel')}
      className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-3 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong"
      onClick={handleCopy}
      type="button"
    >
      <Icon aria-hidden="true" size={15} />
      {copied ? t('copiedLabel') : t('copyLabel')}
    </button>
  );
}
