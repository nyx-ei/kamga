import { getTranslations } from 'next-intl/server';
import { AlertTriangle, CheckCircle2, FileQuestion, Loader2 } from 'lucide-react';

import { DeclineReasonDisplay } from '@/features/memberships/components/DeclineReasonDisplay';
import { Link } from '@/i18n/navigation';

type MemberApplicationStatus = 'active' | 'declined' | 'needs_more_evidence' | 'pending' | 'suspended';

type ApplicationStatusCardProps = {
  application: {
    associationName: string;
    declineReasonHtml: null | string;
    requestedEvidenceTypes: Array<'government_id' | 'immigration_proof'>;
    status: MemberApplicationStatus;
    submittedAtLabel: string;
  };
};

function statusTone(status: MemberApplicationStatus): {
  containerClassName: string;
  icon: 'alert' | 'check' | 'file' | 'spinner';
} {
  if (status === 'active') {
    return { containerClassName: 'bg-positive-bg text-positive', icon: 'check' };
  }

  if (status === 'declined' || status === 'suspended') {
    return { containerClassName: 'bg-negative-bg text-negative', icon: 'alert' };
  }

  if (status === 'needs_more_evidence') {
    return { containerClassName: 'bg-warning-bg text-warning', icon: 'file' };
  }

  return { containerClassName: 'bg-info-bg text-info', icon: 'spinner' };
}

function StatusIcon({ icon }: { icon: 'alert' | 'check' | 'file' | 'spinner' }) {
  if (icon === 'check') {
    return <CheckCircle2 aria-hidden="true" size={20} />;
  }

  if (icon === 'alert') {
    return <AlertTriangle aria-hidden="true" size={20} />;
  }

  if (icon === 'file') {
    return <FileQuestion aria-hidden="true" size={20} />;
  }

  return <Loader2 aria-hidden="true" className="animate-spin" size={20} />;
}

export async function ApplicationStatusCard({ application }: ApplicationStatusCardProps) {
  const t = await getTranslations('dashboard.application');
  const tone = statusTone(application.status);

  return (
    <article className="grid gap-5 rounded-md border border-border bg-raised p-5 shadow-card">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted">{application.associationName}</p>
          <h2 className="text-xl font-semibold text-heading">{t(`statuses.${application.status}.title`)}</h2>
          <p className="text-sm leading-6 text-secondary">{t(`statuses.${application.status}.description`)}</p>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium ${tone.containerClassName}`}>
          <StatusIcon icon={tone.icon} />
          {t(`statusLabels.${application.status}`)}
        </div>
      </div>

      <dl className="rounded-sm border border-border bg-sunken p-4 text-sm">
        <dt className="font-medium text-secondary">{t('submittedAtLabel')}</dt>
        <dd className="mt-1 text-heading">{application.submittedAtLabel}</dd>
      </dl>

      {application.status === 'needs_more_evidence' ? (
        <div className="grid gap-3 rounded-sm border border-border bg-warning-bg p-4 text-sm text-warning">
          <p className="font-medium">{t('requestedEvidenceTitle')}</p>
          <ul className="ml-5 list-disc">
            {application.requestedEvidenceTypes.map((type) => (
              <li key={type}>{t(`evidenceTypes.${type}`)}</li>
            ))}
          </ul>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
            href="/dashboard/upload-evidence"
          >
            {t('uploadAction')}
          </Link>
        </div>
      ) : null}

      {application.status === 'active' ? (
        <div className="rounded-sm border border-border bg-positive-bg p-4 text-sm leading-6 text-positive">{t('memberFeaturesPlaceholder')}</div>
      ) : null}

      {application.status === 'declined' ? (
        <div className="grid gap-3">
          <p className="text-sm font-medium text-secondary">{t('declineReasonTitle')}</p>
          {application.declineReasonHtml === null || application.declineReasonHtml.length === 0 ? (
            <p className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('declineReasonMissing')}</p>
          ) : (
            <DeclineReasonDisplay html={application.declineReasonHtml} />
          )}
          <p className="text-sm leading-6 text-secondary">{t('futureInvites')}</p>
        </div>
      ) : null}
    </article>
  );
}
