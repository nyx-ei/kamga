'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Check, ChevronLeft, ChevronRight, Info, UploadCloud } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { registerAssociation } from '@/features/associations/actions';
import type { AssociationActionState } from '@/features/associations/association-types';

type AssociationRegistrationFormProps = {
  locale: 'en' | 'fr';
};

type WizardStep = 1 | 2 | 3;

const initialState: AssociationActionState = { ok: true };
const steps: WizardStep[] = [1, 2, 3];

function SubmitButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations('associations.registration');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled || pending}
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

function stepClassName(step: WizardStep, currentStep: WizardStep, completed: boolean): string {
  if (step === currentStep) {
    return 'bg-blue-950 text-white';
  }

  if (completed) {
    return 'bg-[#4d67c7] text-white';
  }

  return 'bg-[#eef1f7] text-secondary';
}

export function AssociationRegistrationForm({ locale }: AssociationRegistrationFormProps) {
  const t = useTranslations('associations.registration');
  const [state, formAction] = useFormState(registerAssociation, initialState);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState<'fr' | 'en' | 'fr_en'>('fr');
  const [, setHasProof] = useState(false);
  const messageCode = actionMessage(state);

  const completedSteps = useMemo(
    () => ({
      1: name.trim().length > 0 && city.trim().length > 0 && postalCode.trim().length > 0,
      2: primaryLanguage.length > 0,
      3: true
    }),
    [city, name, postalCode, primaryLanguage]
  );

  const canAdvance = completedSteps[currentStep];
  const canSubmit = completedSteps[1] && completedSteps[2] && completedSteps[3];

  return (
    <form action={formAction} className="grid gap-8" noValidate>
      <input name="locale" type="hidden" value={locale} />

      {messageCode === null ? null : (
        <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">
          {t(`errors.${messageCode}`)} ({messageCode})
        </p>
      )}

      <nav aria-label={t('wizard.title')} className="rounded-md border border-border bg-card p-6 shadow-card">
        <ol className="flex flex-col gap-5 md:flex-row md:items-center">
          {steps.map((step, index) => {
            const completed = completedSteps[step] && step !== currentStep;
            const label =
              step === 1 ? t('wizard.identityStep') : step === 2 ? t('wizard.legitimacyStep') : t('wizard.publicStep');

            return (
              <li className="flex flex-1 items-center gap-4" key={step}>
                <button
                  aria-current={step === currentStep ? 'step' : undefined}
                  className="flex items-center gap-4 text-left"
                  onClick={() => setCurrentStep(step)}
                  type="button"
                >
                  <span className={`grid size-9 place-items-center rounded-full text-sm font-semibold ${stepClassName(step, currentStep, completed)}`}>
                    {completed ? <Check aria-hidden="true" size={16} /> : step}
                  </span>
                  <span className={`font-semibold ${step === currentStep ? 'text-heading' : 'text-secondary'}`}>{label}</span>
                </button>
                {index < steps.length - 1 ? <span className="hidden h-px flex-1 bg-border md:block" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className={currentStep === 1 ? 'grid gap-7' : 'hidden'}>
        <section className="grid gap-5">
          <p className="text-xs font-semibold uppercase text-muted">{t('fields.identityLabel')}</p>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-heading" htmlFor="association-name">
                {t('fields.officialNameLabel')}
              </label>
              <input
                className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
                id="association-name"
                maxLength={180}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder={t('namePlaceholder')}
                required
                type="text"
                value={name}
              />
              {!state.ok && state.fieldErrors?.name !== undefined ? (
                <p className="text-sm font-medium text-negative">
                  {t(`errors.${state.fieldErrors.name}`)} ({state.fieldErrors.name})
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-heading" htmlFor="association-common-name">
                {t('fields.commonNameLabel')}
              </label>
              <input
                className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
                id="association-common-name"
                maxLength={180}
                name="commonName"
                placeholder={t('fields.commonNamePlaceholder')}
                type="text"
              />
              <p className="text-sm text-secondary">{t('fields.commonNameHelp')}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-xs font-semibold uppercase text-muted">{t('fields.locationLabel')}</p>
            <p className="text-sm text-secondary">{t('fields.locationHelp')}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_220px_220px]">
            <div className="grid gap-2 lg:col-span-3">
              <label className="text-sm font-semibold text-heading" htmlFor="association-street">
                {t('fields.streetLabel')}
              </label>
              <input
                className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
                id="association-street"
                maxLength={220}
                name="streetAddress"
                placeholder={t('fields.streetPlaceholder')}
                type="text"
              />
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
                onChange={(event) => setCity(event.target.value)}
                placeholder={t('cityPlaceholder')}
                required
                type="text"
                value={city}
              />
              {!state.ok && state.fieldErrors?.city !== undefined ? (
                <p className="text-sm font-medium text-negative">
                  {t(`errors.${state.fieldErrors.city}`)} ({state.fieldErrors.city})
                </p>
              ) : null}
            </div>
            <label className="grid gap-2 text-sm font-semibold text-heading">
              {t('fields.provinceLabel')}
              <select className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition focus:border-focus" defaultValue="QC" name="province">
                <option value="QC">QC</option>
                <option value="ON">ON</option>
                <option value="NB">NB</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-heading">
              {t('fields.postalCodeLabel')}
              <input
                className="h-12 rounded-sm border border-input bg-raised px-4 font-mono text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
                maxLength={12}
                name="postalCode"
                onChange={(event) => setPostalCode(event.target.value)}
                placeholder={t('fields.postalCodePlaceholder')}
                required
                type="text"
                value={postalCode}
              />
            </label>
          </div>
          <div className="flex items-center gap-4 rounded-sm border border-border bg-sunken px-5 py-4 text-sm text-secondary">
            <Info aria-hidden="true" size={22} />
            <span>{t('fields.geocodingPending')}</span>
          </div>
        </section>
      </section>

      <section className={currentStep === 2 ? 'grid gap-7' : 'hidden'}>
        <section className="grid gap-5">
          <h2 className="text-2xl font-semibold text-heading">{t('fields.legitimacyTitle')}</h2>
          <p className="text-sm text-secondary">{t('fields.legitimacyDescription')}</p>
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-heading">
              {t('fields.legalFormLabel')}
              <select className="h-12 cursor-not-allowed rounded-sm border border-input bg-sunken px-4 text-sm text-muted shadow-card" defaultValue="Quebec NFP" disabled>
                <option>Quebec NFP</option>
                <option>Federal non-profit</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-heading">
              {t('fields.languageLabel')}
              <select
                className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition focus:border-focus"
                name="primaryLanguage"
                onChange={(event) => setPrimaryLanguage(event.target.value as 'fr' | 'en' | 'fr_en')}
                value={primaryLanguage}
              >
                <option value="fr">{t('fields.languageFrench')}</option>
                <option value="en">{t('fields.languageEnglish')}</option>
                <option value="fr_en">{t('fields.languageBilingual')}</option>
              </select>
            </label>
          </div>
          <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
            <label className="grid gap-2 text-sm font-semibold text-heading">
              {t('fields.registryTypeLabel')}
              <select className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition focus:border-focus" defaultValue="" name="registryType">
                <option value="">{t('fields.registryTypePlaceholder')}</option>
                <option value="neq">{t('fields.registryTypeNeq')}</option>
                <option value="federal">{t('fields.registryTypeFederal')}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-heading">
              {t('fields.registryNumberLabel')}
              <input
                className="h-12 rounded-sm border border-input bg-raised px-4 font-mono text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
                maxLength={64}
                name="registryNumber"
                placeholder={t('fields.registryNumberPlaceholder')}
                type="text"
              />
            </label>
          </div>
          <div className="flex items-start gap-4 rounded-sm border border-border bg-sunken px-6 py-5 text-secondary">
            <Info aria-hidden="true" className="mt-1 shrink-0" size={24} />
            <p>
              <strong className="block text-heading">{t('fields.registryPendingTitle')}</strong>
              {t('fields.registryPendingDescription')}
            </p>
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
              onChange={(event) => setHasProof((event.target.files?.length ?? 0) > 0)}
              type="file"
            />
          </div>
          {!state.ok && state.fieldErrors?.rpnAffiliationProof !== undefined ? (
            <p className="text-sm font-medium text-negative">
              {t(`errors.${state.fieldErrors.rpnAffiliationProof}`)} ({state.fieldErrors.rpnAffiliationProof})
            </p>
          ) : null}
        </div>
      </section>

      <section className={currentStep === 3 ? 'grid gap-7' : 'hidden'}>
        <section className="grid gap-5">
          <h2 className="text-2xl font-semibold text-heading">{t('fields.publicTitle')}</h2>
          <p className="text-sm text-secondary">{t('fields.publicDescription')}</p>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-heading" htmlFor="association-contact-email">
              {t('contactEmailLabel')}
            </label>
            <input
              className="h-12 rounded-sm border border-input bg-raised px-4 text-sm text-body shadow-card transition placeholder:text-muted focus:border-focus"
              id="association-contact-email"
              maxLength={254}
              name="contactEmail"
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder={t('contactEmailPlaceholder')}
              type="email"
              value={contactEmail}
            />
            {!state.ok && state.fieldErrors?.contactEmail !== undefined ? (
              <p className="text-sm font-medium text-negative">
                {t(`errors.${state.fieldErrors.contactEmail}`)} ({state.fieldErrors.contactEmail})
              </p>
            ) : null}
          </div>
        </section>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          className="inline-flex items-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-semibold text-body shadow-card transition hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentStep === 1}
          onClick={() => setCurrentStep((currentStep - 1) as WizardStep)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          {t('wizard.back')}
        </button>

        {currentStep < 3 ? (
          <button
            className="inline-flex items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAdvance}
            onClick={() => setCurrentStep((currentStep + 1) as WizardStep)}
            type="button"
          >
            {t('wizard.next')}
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        ) : (
          <SubmitButton disabled={!canSubmit} />
        )}
      </div>
    </form>
  );
}
