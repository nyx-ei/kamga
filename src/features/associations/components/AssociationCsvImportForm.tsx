'use client';

import { CheckCircle2, FileUp, Upload, XCircle } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { type AssociationCsvImportState, importAssociationsCsv } from '@/features/associations/actions';

type AssociationCsvImportFormProps = {
  copy: {
    chooseFile: string;
    csvDescription: string;
    csvDrop: string;
    downloadTemplate: string;
    importRows: string;
    preview: string;
    resultImported: string;
    resultSkipped: string;
    resultsTitle: string;
    errors: Record<string, string>;
  };
};

const ASSOCIATION_CSV_TEMPLATE =
  'official_name,common_name,city,province,postal_code,primary_language,registry_type,registry_number,street_address,contact_email,description\n';

const initialState: AssociationCsvImportState = {
  imported: 0,
  ok: true,
  rows: [],
  skipped: 0
};

function ImportButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center gap-2 rounded-sm bg-brand px-5 py-2 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <CheckCircle2 aria-hidden="true" size={16} />
      {pending ? label + '...' : label}
    </button>
  );
}

function templateHref(): string {
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(ASSOCIATION_CSV_TEMPLATE);
}

export function AssociationCsvImportForm({ copy }: AssociationCsvImportFormProps) {
  const [state, formAction] = useFormState(importAssociationsCsv, initialState);

  return (
    <form action={formAction} className="grid gap-8">
      <div className="grid min-h-[315px] place-items-center rounded-md border border-dashed border-brand bg-sunken p-10 text-center">
        <div>
          <Upload aria-hidden="true" className="mx-auto text-[#4d67c7]" size={46} />
          <h2 className="mt-6 text-2xl font-semibold text-heading">{copy.csvDrop}</h2>
          <p className="mt-3 text-sm leading-6 text-secondary">{copy.csvDescription}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-heading shadow-card transition hover:bg-brand-strong">
              <FileUp aria-hidden="true" size={16} />
              {copy.chooseFile}
              <input accept=".csv,text/csv" className="sr-only" name="csvFile" required type="file" />
            </label>
            <a className="inline-flex items-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold text-brand" download="kamga_associations_template.csv" href={templateHref()}>
              {copy.downloadTemplate}
            </a>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-heading">{copy.preview}</h2>
            <span className="rounded-full bg-positive-bg px-3 py-1 text-xs font-semibold text-positive">
              {state.imported} {copy.resultImported}
            </span>
            <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">
              {state.skipped} {copy.resultSkipped}
            </span>
          </div>
          <ImportButton label={copy.importRows} />
        </div>
        {state.rows.length === 0 ? (
          <div className="px-6 py-10 text-sm leading-6 text-secondary">{copy.resultsTitle}</div>
        ) : (
          <div className="divide-y divide-border">
            {state.rows.map((row) => {
              const imported = row.status === 'imported';
              return (
                <div className="grid gap-3 px-6 py-4 text-sm md:grid-cols-[80px_1fr_220px]" key={`${row.rowNumber}:${row.name ?? row.message}`}>
                  <span className="font-mono text-muted">#{row.rowNumber}</span>
                  <span className="font-semibold text-heading">{row.name ?? '-'}</span>
                  <span className={`inline-flex items-center gap-2 font-semibold ${imported ? 'text-positive' : 'text-warning'}`}>
                    {imported ? <CheckCircle2 aria-hidden="true" size={16} /> : <XCircle aria-hidden="true" size={16} />}
                    {copy.errors[row.message] ?? row.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </form>
  );
}
