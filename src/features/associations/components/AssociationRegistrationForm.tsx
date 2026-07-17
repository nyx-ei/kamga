'use client';

import { useTranslations } from 'next-intl';
import { Building2, CheckCircle2, Crosshair, UploadCloud } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { registerAssociation } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

type AssociationRegistrationFormProps = {
  locale: 'en' | 'fr';
};

const initialState: AssociationActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('associations.registration');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Building2 aria-hidden="true" size={16} />
      {pending ? t('submitting') : t('submit')}
    </button>
  );
}

function actionMessage(state: AssociationActionState): string | null {
  if (state.ok) {
    return null;
  }

  return state.code;
}

export function AssociationRegistrationForm({ locale }: AssociationRegistrationFormProps) {
  const t = useTranslations('associations.registration');
  const [state, formAction] = useFormState(registerAssociation, initialState);
  const messageCode = actionMessage(state);

  return (
    <form action={formAction} className="grid gap-8" noValidate>
      <input name="locale" type="hidden" value={locale} />

      {messageCode === null ? null : (
        <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">
          {t(`errors.${messageCode}`)} ({messageCode})
        </p>
      )}

      <section className="grid gap-5">
        <p className="text-xs font-semibold uppercase text-muted">Identity</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-heading" htmlFor="association-name">
              Official name
            </label>
            <input
              className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
              id="association-name"
              maxLength={180}
              name="name"
              placeholder={t('namePlaceholder')}
              required
              type="text"
            />
            {!state.ok && state.fieldErrors?.name !== undefined ? (
              <p className="text-sm font-medium text-negative">
                {t(`errors.${state.fieldErrors.name}`)} ({state.fieldErrors.name})
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-heading" htmlFor="association-common-name">
              Common name
            </label>
            <input
              className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
              id="association-common-name"
              placeholder="Optional"
              type="text"
            />
            <p className="text-sm text-secondary">Display name if different</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-xs font-semibold uppercase text-muted">Location</p>
          <p className="text-sm text-secondary">Coordinates are geocoded from the postal code - never typed.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_220px_220px]">
          <div className="grid gap-2 lg:col-span-3">
            <label className="text-sm font-semibold text-heading" htmlFor="association-street">
              Street address
            </label>
            <input className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card" id="association-street" placeholder="123 Rue Saint-Viateur O" type="text" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-heading" htmlFor="association-city">
              {t('cityLabel')}
            </label>
            <input
              className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
              id="association-city"
              maxLength={120}
              name="city"
              placeholder={t('cityPlaceholder')}
              required
              type="text"
            />
            {!state.ok && state.fieldErrors?.city !== undefined ? (
              <p className="text-sm font-medium text-negative">
                {t(`errors.${state.fieldErrors.city}`)} ({state.fieldErrors.city})
              </p>
            ) : null}
          </div>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            Province
            <select className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card" defaultValue="QC">
              <option>QC</option>
              <option>ON</option>
              <option>NB</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            Postal code
            <input className="h-12 rounded-sm border border-input bg-raised px-4 font-mono text-sm text-body shadow-card" placeholder="H2T 1S9" type="text" />
          </label>
        </div>
        <div className="flex items-center gap-4 rounded-sm border border-border bg-sunken px-5 py-4 text-sm text-heading">
          <Crosshair aria-hidden="true" className="text-positive" size={22} />
          <span>Geocoded to</span>
          <span className="font-mono font-semibold">45.5231N, 73.6000W</span>
          <span className="rounded-full bg-positive-bg px-3 py-1 text-xs font-semibold text-positive">Matched</span>
        </div>
      </section>

      <section className="grid gap-5">
        <h2 className="text-2xl font-semibold text-heading">Verify legitimacy</h2>
        <p className="text-sm text-secondary">Enter your registration number. We check it against Quebec&apos;s REQ open data automatically.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-heading">
            Legal form
            <select className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card" defaultValue="Quebec NFP">
              <option>Quebec NFP</option>
              <option>Federal non-profit</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-heading">
            Primary language
            <select className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card" defaultValue="French">
              <option>French</option>
              <option>English</option>
              <option>French & English</option>
            </select>
          </label>
        </div>
        <div className="flex items-start gap-4 rounded-sm border border-positive/30 bg-positive-bg px-6 py-5 text-positive">
          <CheckCircle2 aria-hidden="true" className="mt-1 shrink-0" size={24} />
          <p>
            <strong className="block">Match confirmed in REQ open data</strong>
            NEQ 1169920034 - registered non-profit - active. Your listing will show a Verified badge.
          </p>
        </div>
      </section>

      <section className="grid gap-5">
        <h2 className="text-2xl font-semibold text-heading">Choose what&apos;s public</h2>
        <p className="text-sm text-secondary">Contact details stay private unless you opt in. Members reach you through a mediated request.</p>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-heading" htmlFor="association-contact-email">
            {t('contactEmailLabel')}
          </label>
          <input
            className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
            id="association-contact-email"
            maxLength={254}
            name="contactEmail"
            placeholder={t('contactEmailPlaceholder')}
            required
            type="email"
          />
          {!state.ok && state.fieldErrors?.contactEmail !== undefined ? (
            <p className="text-sm font-medium text-negative">
              {t(`errors.${state.fieldErrors.contactEmail}`)} ({state.fieldErrors.contactEmail})
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-heading" htmlFor="association-proof">
          {t('proofLabel')}
        </label>
        <div className="flex flex-col gap-3 rounded-md border border-border bg-sunken p-4">
          <div className="flex items-start gap-3 text-sm text-secondary">
            <UploadCloud aria-hidden="true" className="mt-1 shrink-0 text-muted" size={18} />
            <p>{t('proofHelp')}</p>
          </div>
          <input
            accept="application/pdf,image/jpeg,image/png"
            className="text-sm text-body file:mr-3 file:rounded-sm file:border file:border-border file:bg-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-body"
            id="association-proof"
            name="rpnAffiliationProof"
            required
            type="file"
          />
        </div>
        {!state.ok && state.fieldErrors?.rpnAffiliationProof !== undefined ? (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${state.fieldErrors.rpnAffiliationProof}`)} ({state.fieldErrors.rpnAffiliationProof})
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
