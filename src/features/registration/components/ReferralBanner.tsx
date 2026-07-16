import { UserRoundCheck } from 'lucide-react';

type ReferralBannerProps = {
  associationName: string;
  expiresAtLabel: string;
  referredByLabel: string;
  title: string;
};

export function ReferralBanner({ associationName, expiresAtLabel, referredByLabel, title }: ReferralBannerProps) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-sunken p-5">
      <div className="flex items-start gap-3">
        <UserRoundCheck aria-hidden="true" className="mt-1 shrink-0 text-muted" size={20} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-secondary">{referredByLabel}</p>
          <h2 className="text-xl font-semibold text-heading">{title}</h2>
        </div>
      </div>
      <dl className="grid gap-2 text-sm text-secondary md:grid-cols-2">
        <div>
          <dt className="font-medium text-muted">{associationName}</dt>
        </div>
        <div>
          <dt className="font-medium text-muted">{expiresAtLabel}</dt>
        </div>
      </dl>
    </div>
  );
}
