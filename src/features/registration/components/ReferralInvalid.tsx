import { AlertCircle } from 'lucide-react';

import type { ReferralTokenValidationCode } from '@/lib/referrals/tokens';

type ReferralInvalidProps = {
  code: ReferralTokenValidationCode;
  message: string;
};

export function ReferralInvalid({ code, message }: ReferralInvalidProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-negative-bg p-5 text-negative">
      <AlertCircle aria-hidden="true" className="mt-1 shrink-0" size={20} />
      <p className="text-sm font-medium">
        {message} ({code})
      </p>
    </div>
  );
}
