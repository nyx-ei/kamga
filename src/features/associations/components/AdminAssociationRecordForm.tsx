'use client';

import { Save } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateAdminAssociationRecord } from '@/features/associations/actions';
import type {
  AssociationActionState,
  AssociationClaimStatus,
  AssociationGeocodeStatus,
  AssociationPrimaryLanguage,
  AssociationSource,
  AssociationStatus,
  AssociationVerificationStatus
} from '@/features/associations/association-types';

type AdminAssociationRecord = {
  city: string;
  claim_status: AssociationClaimStatus;
  common_name: string | null;
  common_name_en: string | null;
  common_name_fr: string | null;
  contact_email: string | null;
  contact_notification_opt_in_status: 'confirmed' | 'pending' | 'withdrawn';
  description: string | null;
  description_en: string | null;
  description_fr: string | null;
  geocode_status: AssociationGeocodeStatus;
  id: string;
  official_name: string;
  postal_code: string | null;
  primary_language: AssociationPrimaryLanguage;
  province: string;
  public_contact_email: boolean;
  public_precision: 'exact' | 'neighbourhood';
  registry_number: string | null;
  registry_type: 'federal' | 'neq' | null;
  source: AssociationSource;
  status: AssociationStatus;
  street_address: string | null;
  verification_status: AssociationVerificationStatus;
};

type AdminAssociationRecordFormProps = {
  association: AdminAssociationRecord;
  copy: {
    cityLabel: string;
    claimStatusLabel: string;
    commonNameHelp: string;
    commonNameLabel: string;
    commonNameEnLabel: string;
    commonNameFrLabel: string;
    contactEmailHelp: string;
    contactEmailLabel: string;
    descriptionLabel: string;
    descriptionEnLabel: string;
    descriptionFrLabel: string;
    exactPrecisionLabel: string;
    geocodeStatusLabel: string;
    languageLabel: string;
    nameLabel: string;
    neighbourhoodPrecisionLabel: string;
    optInLabel: string;
    postalCodeLabel: string;
    provinceLabel: string;
    publicContactEmailLabel: string;
    publicPrecisionHelp: string;
    publicPrecisionLabel: string;
    registryNumberLabel: string;
    registryTypeLabel: string;
    saved: string;
    saveAction: string;
    saving: string;
    sourceLabel: string;
    statusLabel: string;
    streetLabel: string;
    verificationStatusLabel: string;
    errors: Record<string, string>;
    claimStatuses: Record<AssociationClaimStatus, string>;
    geocodeStatuses: Record<AssociationGeocodeStatus, string>;
    optInStatuses: Record<AdminAssociationRecord['contact_notification_opt_in_status'], string>;
    primaryLanguages: Record<AssociationPrimaryLanguage, string>;
    publicPrecisions: Record<AdminAssociationRecord['public_precision'], string>;
    registryTypes: Record<'federal' | 'neq', string>;
    sources: Record<AssociationSource, string>;
    statuses: Record<AssociationStatus, string>;
    verificationStatuses: Record<AssociationVerificationStatus, string>;
  };
  locale: 'en' | 'fr';
};

const initialState: AssociationActionState = { ok: true };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-5 py-3 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Save aria-hidden="true" size={16} />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AdminAssociationRecordForm({ association, copy, locale }: AdminAssociationRecordFormProps) {
  const [state, formAction] = useFormState(updateAdminAssociationRecord, initialState);

  return (
    <form action={formAction} className="grid gap-6 rounded-md border border-border bg-raised p-5 shadow-card">
      <input name="associationId" type="hidden" value={association.id} />
      <input name="locale" type="hidden" value={locale} />

      {state.ok && state.submitted ? <p className="rounded-sm border border-positive/20 bg-positive-bg px-4 py-3 text-sm font-semibold text-positive">{copy.saved}</p> : null}
      {!state.ok ? (
        <p className="rounded-sm border border-negative/20 bg-negative-bg px-4 py-3 text-sm font-semibold text-negative">
          {copy.errors[state.code] ?? copy.errors['KMG-SYS-000']} ({state.code})
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.statusLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.status} name="status">
            {Object.entries(copy.statuses).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.verificationStatusLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.verification_status} name="verificationStatus">
            {Object.entries(copy.verificationStatuses).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.claimStatusLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.claim_status} name="claimStatus">
            {Object.entries(copy.claimStatuses).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.geocodeStatusLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.geocode_status} name="geocodeStatus">
            {Object.entries(copy.geocodeStatuses).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.nameLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.official_name} maxLength={180} name="officialName" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.commonNameLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.common_name ?? ''} maxLength={180} name="commonName" />
          <span className="text-sm font-normal text-secondary">{copy.commonNameHelp}</span>
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.commonNameEnLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.common_name_en ?? ''} maxLength={180} name="commonNameEn" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.commonNameFrLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.common_name_fr ?? ''} maxLength={180} name="commonNameFr" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-heading">
        {copy.descriptionLabel}
        <textarea className="min-h-24 rounded-sm border border-input bg-card px-4 py-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.description ?? ''} maxLength={1200} name="description" />
      </label>
      <div className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.descriptionEnLabel}
          <textarea className="min-h-24 rounded-sm border border-input bg-card px-4 py-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.description_en ?? ''} maxLength={1200} name="descriptionEn" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.descriptionFrLabel}
          <textarea className="min-h-24 rounded-sm border border-input bg-card px-4 py-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.description_fr ?? ''} maxLength={1200} name="descriptionFr" />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_160px_180px]">
        <label className="grid gap-2 text-sm font-semibold text-heading lg:col-span-3">
          {copy.streetLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.street_address ?? ''} maxLength={220} name="streetAddress" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.cityLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.city} maxLength={120} name="city" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.provinceLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm uppercase text-body shadow-card focus:border-focus" defaultValue={association.province} maxLength={2} minLength={2} name="province" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.postalCodeLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 font-mono text-sm text-body shadow-card focus:border-focus" defaultValue={association.postal_code ?? ''} maxLength={12} name="postalCode" required />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.languageLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.primary_language} name="primaryLanguage">
            {Object.entries(copy.primaryLanguages).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.publicPrecisionLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.public_precision} name="publicPrecision">
            {Object.entries(copy.publicPrecisions).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="text-sm font-normal text-secondary">{copy.publicPrecisionHelp}</span>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.sourceLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.source} name="source">
            {Object.entries(copy.sources).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.registryTypeLabel}
          <select className="h-11 rounded-sm border border-input bg-card px-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.registry_type ?? ''} name="registryType">
            <option value="">-</option>
            {Object.entries(copy.registryTypes).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.registryNumberLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 font-mono text-sm text-body shadow-card focus:border-focus" defaultValue={association.registry_number ?? ''} maxLength={64} name="registryNumber" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.contactEmailLabel}
          <input className="h-12 rounded-sm border border-input bg-card px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.contact_email ?? ''} maxLength={254} name="contactEmail" type="email" />
          <span className="text-sm font-normal text-secondary">{copy.contactEmailHelp}</span>
        </label>
      </div>

      <div className="grid gap-3 rounded-sm border border-border bg-sunken p-4">
        <p className="text-sm text-secondary"><span className="font-semibold text-heading">{copy.optInLabel}</span> {copy.optInStatuses[association.contact_notification_opt_in_status]}</p>
        <label className="inline-flex items-center gap-3 text-sm font-semibold text-heading">
          <input defaultChecked={association.public_contact_email} name="publicContactEmail" type="checkbox" />
          {copy.publicContactEmailLabel}
        </label>
      </div>

      <SubmitButton label={copy.saveAction} pendingLabel={copy.saving} />
    </form>
  );
}
