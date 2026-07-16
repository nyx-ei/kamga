import { associationStatusTone } from '@/features/associations/association-status';
import type { AssociationStatus } from '@/features/associations/association-types';
import { cn } from '@/lib/utils/cn';

type AssociationStatusBadgeProps = {
  label: string;
  status: AssociationStatus;
};

export function AssociationStatusBadge({ label, status }: AssociationStatusBadgeProps) {
  const tone = associationStatusTone(status);

  return (
    <span
      className={cn(
        'inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase',
        tone === 'positive' && 'bg-positive-bg text-positive',
        tone === 'warning' && 'bg-warning-bg text-warning',
        tone === 'negative' && 'bg-negative-bg text-negative',
        tone === 'info' && 'bg-info-bg text-info'
      )}
    >
      {label}
    </span>
  );
}
