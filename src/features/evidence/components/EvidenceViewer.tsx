'use client';

import { useTranslations } from 'next-intl';

type EvidenceViewerProps = {
  adminLabel: string;
  evidenceId: string;
  fileName: string;
  storagePath: string;
};

function isImageEvidence(storagePath: string): boolean {
  return /\.(jpe?g|png)$/i.test(storagePath);
}

export function EvidenceViewer({ adminLabel, evidenceId, fileName, storagePath }: EvidenceViewerProps) {
  const t = useTranslations('evidence.viewer');
  const source = `/api/evidence/${evidenceId}`;
  const watermark = `${adminLabel} · ${new Date().toLocaleString()}`;

  function preventInteraction(event: React.SyntheticEvent) {
    event.preventDefault();
  }

  return (
    <div className="relative overflow-hidden rounded-sm border border-border bg-card" onContextMenu={preventInteraction}>
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
        <span className="-rotate-12 rounded-sm border border-border bg-sunken/80 px-4 py-2 text-xs font-semibold uppercase text-muted shadow-card">
          {watermark}
        </span>
      </div>
      {isImageEvidence(storagePath) ? (
        // eslint-disable-next-line @next/next/no-img-element -- CV-SEC-07: evidence is served through a no-store authenticated proxy, not Next image optimization.
        <img
          alt={fileName}
          className="max-h-80 w-full select-none object-contain"
          draggable={false}
          onDragStart={preventInteraction}
          src={source}
        />
      ) : (
        <iframe
          className="h-80 w-full select-none"
          onDragStart={preventInteraction}
          src={source}
          title={t('frameTitle', { name: fileName })}
        />
      )}
    </div>
  );
}
