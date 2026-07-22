'use client';

import { Building2, Save } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { updateOwnedAssociationRecord } from '@/features/associations/actions';
import type { AssociationActionState, AssociationPrimaryLanguage } from '@/features/associations/association-types';

type ManagedAssociationRecord = {
  city: string;
  common_name: string | null;
  common_name_en: string | null;
  common_name_fr: string | null;
  contact_email: string | null;
  contact_notification_opt_in_status: 'confirmed' | 'pending' | 'withdrawn';
  description: string | null;
  description_en: string | null;
  description_fr: string | null;
  id: string;
  official_name: string;
  postal_code: string | null;
  primary_language: AssociationPrimaryLanguage;
  province: string;
  public_contact_email: boolean;
  public_precision: 'exact' | 'neighbourhood';
  street_address: string | null;
  verification_status: 'needs_review' | 'unverified' | 'verified';
};

type AssociationRecordManagementFormProps = {
  association: ManagedAssociationRecord;
  copy: {
    cityLabel: string;
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
    languageLabel: string;
    nameLabel: string;
    neighbourhoodPrecisionLabel: string;
    postalCodeLabel: string;
    provinceLabel: string;
    publicContactEmailLabel: string;
    publicPrecisionHelp: string;
    publicPrecisionLabel: string;
    saved: string;
    saveAction: string;
    saving: string;
    streetLabel: string;
    errors: Record<string, string>;
    optInStatuses: Record<ManagedAssociationRecord['contact_notification_opt_in_status'], string>;
    verificationLabel: string;
    verificationStatuses: Record<ManagedAssociationRecord['verification_status'], string>;
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

export function AssociationRecordManagementForm({ association, copy, locale }: AssociationRecordManagementFormProps) {
  const [state, formAction] = useFormState(updateOwnedAssociationRecord, initialState);

  return (
    <form action={formAction} className="grid gap-8 rounded-md border border-border bg-card p-8 shadow-card">
      <input name="associationId" type="hidden" value={association.id} />
      <input name="locale" type="hidden" value={locale} />

      {state.ok && state.submitted ? <p className="rounded-sm border border-positive/20 bg-positive-bg px-4 py-3 text-sm font-semibold text-positive">{copy.saved}</p> : null}
      {!state.ok ? (
        <p className="rounded-sm border border-negative/20 bg-negative-bg px-4 py-3 text-sm font-semibold text-negative">
          {copy.errors[state.code] ?? copy.errors['KMG-SYS-000']} ({state.code})
        </p>
      ) : null}

      <section className="grid gap-5">
        <div className="flex items-center gap-3">
          <Building2 aria-hidden="true" className="text-muted" size={24} />
          <div>
            <p className="text-sm font-semibold text-secondary">{copy.verificationLabel}</p>
            <p className="text-base font-semibold text-heading">{copy.verificationStatuses[association.verification_status]}</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.nameLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.official_name} maxLength={180} name="officialName" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.commonNameLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.common_name ?? ''} maxLength={180} name="commonName" />
            <span className="text-sm font-normal text-secondary">{copy.commonNameHelp}</span>
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.commonNameEnLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.common_name_en ?? ''} maxLength={180} name="commonNameEn" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.commonNameFrLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.common_name_fr ?? ''} maxLength={180} name="commonNameFr" />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.descriptionLabel}
          <textarea className="min-h-28 rounded-sm border border-input bg-raised px-4 py-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.description ?? ''} maxLength={1200} name="description" />
        </label>
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.descriptionEnLabel}
            <textarea className="min-h-28 rounded-sm border border-input bg-raised px-4 py-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.description_en ?? ''} maxLength={1200} name="descriptionEn" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.descriptionFrLabel}
            <textarea className="min-h-28 rounded-sm border border-input bg-raised px-4 py-3 text-sm text-body shadow-card focus:border-focus" defaultValue={association.description_fr ?? ''} maxLength={1200} name="descriptionFr" />
          </label>
        </div>
      </section>

      <section className="grid gap-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_160px_180px]">
          <label className="grid gap-2 text-sm font-semibold text-heading lg:col-span-3">
            {copy.streetLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.street_address ?? ''} maxLength={220} name="streetAddress" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.cityLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.city} maxLength={120} name="city" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.provinceLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm uppercase text-body shadow-card focus:border-focus" defaultValue={association.province} maxLength={2} minLength={2} name="province" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            {copy.postalCodeLabel}
            <input className="h-12 rounded-sm border border-input bg-raised px-4 font-mono text-sm text-body shadow-card focus:border-focus" defaultValue={association.postal_code ?? ''} maxLength={12} name="postalCode" required />
          </label>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.languageLabel}
          <select className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.primary_language} name="primaryLanguage">
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="fr_en">Français & English</option>
          </select>
        </label>
        <div className="grid gap-3 text-sm font-semibold text-heading">
          {copy.publicPrecisionLabel}
          <label className="inline-flex items-center gap-3 font-medium">
            <input defaultChecked={association.public_precision === 'neighbourhood'} name="publicPrecision" type="radio" value="neighbourhood" />
            {copy.neighbourhoodPrecisionLabel}
          </label>
          <label className="inline-flex items-center gap-3 font-medium">
            <input defaultChecked={association.public_precision === 'exact'} name="publicPrecision" type="radio" value="exact" />
            {copy.exactPrecisionLabel}
          </label>
          <p className="text-sm font-normal text-secondary">{copy.publicPrecisionHelp}</p>
        </div>
      </section>

      <section className="grid gap-4 rounded-sm border border-border bg-sunken p-5">
        <label className="grid gap-2 text-sm font-semibold text-heading">
          {copy.contactEmailLabel}
          <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card focus:border-focus" defaultValue={association.contact_email ?? ''} maxLength={254} name="contactEmail" type="email" />
          <span className="text-sm font-normal text-secondary">{copy.contactEmailHelp}</span>
        </label>
        <p className="text-sm text-secondary">{copy.optInStatuses[association.contact_notification_opt_in_status]}</p>
        <label className="inline-flex items-center gap-3 text-sm font-semibold text-heading">
          <input defaultChecked={association.public_contact_email} name="publicContactEmail" type="checkbox" />
          {copy.publicContactEmailLabel}
        </label>
      </section>

      <SubmitButton label={copy.saveAction} pendingLabel={copy.saving} />
    </form>
  );
}
