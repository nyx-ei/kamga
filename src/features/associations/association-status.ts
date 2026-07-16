import type { AssociationStatus } from '@/features/associations/association-types';

export type AssociationStatusTone = 'info' | 'positive' | 'warning' | 'negative';

export function associationStatusTone(status: AssociationStatus): AssociationStatusTone {
  switch (status) {
    case 'active':
      return 'positive';
    case 'pending_review':
      return 'warning';
    case 'suspended':
    case 'declined':
      return 'negative';
  }
}
