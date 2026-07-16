'use client';

import { type ChangeEvent, type FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Chrome, FileCheck2, Mail, Users } from 'lucide-react';

import { memberRegistrationSchema } from '@/features/registration/registration-schema';
import {
  MAX_SESSION_EVIDENCE_BYTES,
  MEMBER_REGISTRATION_STORAGE_KEY,
  type MemberEvidenceMimeType,
  type StoredEvidenceFile,
  type StoredMemberRegistration
} from '@/features/registration/registration-types';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';

type RegistrationFormProps = {
  associationName: string;
  locale: 'en' | 'fr';
  referralToken: string;
};

type OAuthProvider = 'google' | 'facebook';
type FormStatus = 'idle' | 'loading' | 'sent' | 'error';

type RegistrationFields = {
  dateOfArrivalCanada: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  sin: string;
};

const initialFields: RegistrationFields = {
  dateOfArrivalCanada: '',
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  sin: ''
};

function evidenceMimeType(file: File): MemberEvidenceMimeType | null {
  if (file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png') {
    return file.type;
  }

  return null;
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.72);
}

async function compressImage(file: File): Promise<StoredEvidenceFile | null> {
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('KMG-RG-004'));
      image.src = imageUrl;
    });

    const maxSide = 1400;
    const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d');

    if (context === null) {
      return null;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvasToDataUrl(canvas);

    if (dataUrl.length > MAX_SESSION_EVIDENCE_BYTES) {
      return null;
    }

    return { dataUrl, mimeType: 'image/jpeg', name: file.name };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('KMG-RG-004'));
    reader.readAsDataURL(file);
  });
}

async function prepareEvidence(file: File): Promise<StoredEvidenceFile | null> {
  const mimeType = evidenceMimeType(file);

  if (mimeType === null) {
    return null;
  }

  if (mimeType.startsWith('image/')) {
    return compressImage(file);
  }

  if (file.size > MAX_SESSION_EVIDENCE_BYTES) {
    return null;
  }

  const dataUrl = await fileToDataUrl(file);
  return dataUrl.length > MAX_SESSION_EVIDENCE_BYTES ? null : { dataUrl, mimeType, name: file.name };
}

export function RegistrationForm({ associationName, locale, referralToken }: RegistrationFormProps) {
  const t = useTranslations('memberRegistration.form');
  const [fields, setFields] = useState<RegistrationFields>(initialFields);
  const [consent, setConsent] = useState(false);
  const [governmentId, setGovernmentId] = useState<StoredEvidenceFile | null>(null);
  const [immigrationProof, setImmigrationProof] = useState<StoredEvidenceFile | null>(null);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [provider, setProvider] = useState<OAuthProvider | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  function updateField(field: keyof RegistrationFields, value: string) {
    setFields((currentFields) => ({ ...currentFields, [field]: value }));
  }

  async function handleEvidenceChange(event: ChangeEvent<HTMLInputElement>, evidenceType: 'governmentId' | 'immigrationProof') {
    const file = event.target.files?.[0];

    if (file === undefined) {
      return;
    }

    const evidence = await prepareEvidence(file);

    if (evidence === null) {
      setErrorCode('KMG-RG-004');
      return;
    }

    setErrorCode(null);

    if (evidenceType === 'governmentId') {
      setGovernmentId(evidence);
      return;
    }

    setImmigrationProof(evidence);
  }

  function payload(): StoredMemberRegistration | null {
    if (governmentId === null || immigrationProof === null) {
      return null;
    }

    return {
      consent: true,
      dateOfArrivalCanada: fields.dateOfArrivalCanada,
      email: fields.email,
      firstName: fields.firstName,
      governmentId,
      immigrationProof,
      lastName: fields.lastName,
      locale,
      phone: fields.phone,
      referralToken,
      sin: fields.sin
    };
  }

  function completionPath(): string {
    return `/${locale}/register/complete`;
  }

  function authRedirectUrl(): string {
    return `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(completionPath())}`;
  }

  function storePayload(): boolean {
    const registration = payload();

    if (registration === null || !consent) {
      setErrorCode('KMG-RG-001');
      return false;
    }

    const parsed = memberRegistrationSchema.safeParse(registration);

    if (!parsed.success) {
      setErrorCode('KMG-RG-001');
      return false;
    }

    try {
      sessionStorage.setItem(MEMBER_REGISTRATION_STORAGE_KEY, JSON.stringify(parsed.data));
      return true;
    } catch {
      setErrorCode('KMG-RG-003');
      return false;
    }
  }

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!storePayload()) {
      return;
    }

    setStatus('loading');
    setProvider(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: fields.email,
      options: { emailRedirectTo: authRedirectUrl() }
    });

    setStatus(error === null ? 'sent' : 'error');
  }

  async function handleOAuthSignIn(selectedProvider: OAuthProvider) {
    if (!storePayload()) {
      return;
    }

    setStatus('loading');
    setProvider(selectedProvider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: selectedProvider,
      options: { redirectTo: authRedirectUrl() }
    });

    if (error !== null) {
      setStatus('error');
      setProvider(null);
    }
  }

  return (
    <form className="grid gap-5 rounded-md border border-border bg-card p-6 shadow-card" onSubmit={handleMagicLinkSubmit}>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted">{t('associationEyebrow')}</p>
        <h2 className="text-xl font-semibold text-heading">{associationName}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('firstNameLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body" onChange={(event) => updateField('firstName', event.target.value)} required type="text" value={fields.firstName} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('lastNameLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body" onChange={(event) => updateField('lastName', event.target.value)} required type="text" value={fields.lastName} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('emailLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body" onChange={(event) => updateField('email', event.target.value)} required type="email" value={fields.email} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('phoneLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body" onChange={(event) => updateField('phone', event.target.value)} required type="tel" value={fields.phone} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-heading">
        {t('arrivalDateLabel')}
        <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body" onChange={(event) => updateField('dateOfArrivalCanada', event.target.value)} required type="date" value={fields.dateOfArrivalCanada} />
      </label>

      <div className="grid gap-2 rounded-md border border-border bg-sunken p-4">
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('sinLabel')}
          <input className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body" inputMode="numeric" onChange={(event) => updateField('sin', event.target.value)} placeholder="123 456 789" required type="password" value={fields.sin} />
        </label>
        <p className="text-sm leading-6 text-secondary">{t('sinHelp')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('governmentIdLabel')}
          <input accept="application/pdf,image/jpeg,image/png" className="text-sm text-body file:mr-3 file:rounded-sm file:border file:border-border file:bg-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-body" onChange={(event) => void handleEvidenceChange(event, 'governmentId')} required type="file" />
          {governmentId !== null ? <span className="inline-flex items-center gap-2 text-sm text-positive"><FileCheck2 aria-hidden="true" size={15} />{governmentId.name}</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-medium text-heading">
          {t('immigrationProofLabel')}
          <input accept="application/pdf,image/jpeg,image/png" className="text-sm text-body file:mr-3 file:rounded-sm file:border file:border-border file:bg-raised file:px-3 file:py-2 file:text-sm file:font-medium file:text-body" onChange={(event) => void handleEvidenceChange(event, 'immigrationProof')} required type="file" />
          {immigrationProof !== null ? <span className="inline-flex items-center gap-2 text-sm text-positive"><FileCheck2 aria-hidden="true" size={15} />{immigrationProof.name}</span> : null}
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-sm border border-border bg-sunken p-4 text-sm leading-6 text-body">
        <input checked={consent} className="mt-1" onChange={(event) => setConsent(event.target.checked)} required type="checkbox" />
        <span>{t('consentLabel')}</span>
      </label>

      {errorCode !== null ? <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">{t(`errors.${errorCode}`)} ({errorCode})</p> : null}
      {status === 'sent' ? <p className="rounded-sm border border-border bg-positive-bg px-4 py-3 text-sm font-medium text-positive">{t('sentMessage')}</p> : null}
      {status === 'error' ? <p className="rounded-sm border border-border bg-negative-bg px-4 py-3 text-sm font-medium text-negative">{t('authError')}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <button className="inline-flex items-center justify-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70" disabled={status === 'loading'} type="submit">
          <Mail aria-hidden="true" size={16} />
          {status === 'loading' && provider === null ? t('sending') : t('magicLinkAction')}
        </button>
        <button className={cn('inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong', status === 'loading' ? 'cursor-not-allowed text-disabled' : null)} disabled={status === 'loading'} onClick={() => void handleOAuthSignIn('google')} type="button">
          <Chrome aria-hidden="true" size={16} />
          {provider === 'google' ? t('connecting') : t('googleAction')}
        </button>
        <button className={cn('inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong', status === 'loading' ? 'cursor-not-allowed text-disabled' : null)} disabled={status === 'loading'} onClick={() => void handleOAuthSignIn('facebook')} type="button">
          <Users aria-hidden="true" size={16} />
          {provider === 'facebook' ? t('connecting') : t('facebookAction')}
        </button>
      </div>
    </form>
  );
}
