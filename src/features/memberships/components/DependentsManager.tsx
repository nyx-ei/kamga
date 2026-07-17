'use client';

import { useTranslations } from 'next-intl';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useFormState, useFormStatus } from 'react-dom';

import { addDependent, removeDependent, updateDependent } from '@/features/memberships/actions';
import type { MembershipActionState } from '@/features/memberships/membership-types';

type Dependent = {
  externalId: null | string;
  fullName: string;
  id: string;
  relationship: string;
};

type DependentsManagerProps = {
  dependents: Dependent[];
  membershipId: string;
};

const initialState: MembershipActionState = { ok: true };

function AddSubmitButton() {
  const t = useTranslations('dashboard.shares');
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex w-fit items-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Plus aria-hidden="true" size={16} />
      {pending ? t('adding') : t('addAction')}
    </button>
  );
}

function RemoveSubmitButton() {
  const t = useTranslations('dashboard.shares');
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={t('removeAction')}
      className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-card text-negative shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Trash2 aria-hidden="true" size={16} />
    </button>
  );
}

function UpdateSubmitButton() {
  const t = useTranslations('dashboard.shares');
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={t('updateAction')}
      className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-card text-body shadow-card transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      <Save aria-hidden="true" size={16} />
    </button>
  );
}

function RemoveDependentForm({ dependentId, membershipId }: { dependentId: string; membershipId: string }) {
  const t = useTranslations('dashboard.shares');
  const [state, action] = useFormState(removeDependent, initialState);

  return (
    <form action={action} className="grid gap-2">
      <input name="dependentId" type="hidden" value={dependentId} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <RemoveSubmitButton />
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}

function UpdateDependentForm({ dependent, membershipId }: { dependent: Dependent; membershipId: string }) {
  const t = useTranslations('dashboard.shares');
  const [state, action] = useFormState(updateDependent, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-sm border border-border bg-card p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
      <input name="dependentId" type="hidden" value={dependent.id} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <label className="grid gap-1 text-xs font-medium text-secondary">
        {t('fullNameLabel')}
        <input className="rounded-sm border border-input bg-sunken px-3 py-2 text-sm text-body" defaultValue={dependent.fullName} maxLength={160} name="fullName" required type="text" />
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        {t('relationshipLabel')}
        <input className="rounded-sm border border-input bg-sunken px-3 py-2 text-sm text-body" defaultValue={dependent.relationship} maxLength={80} name="relationship" required type="text" />
      </label>
      <label className="grid gap-1 text-xs font-medium text-secondary">
        {t('externalIdLabel')}
        <input className="rounded-sm border border-input bg-sunken px-3 py-2 text-sm text-body" defaultValue={dependent.externalId ?? ''} maxLength={120} name="externalId" type="text" />
      </label>
      <div className="self-end">
        <UpdateSubmitButton />
      </div>
      {state.ok ? null : (
        <p className="text-sm font-medium text-negative md:col-span-4">
          {t(`errors.${state.code}`)} ({state.code})
        </p>
      )}
    </form>
  );
}

export function DependentsManager({ dependents, membershipId }: DependentsManagerProps) {
  const t = useTranslations('dashboard.shares');
  const [state, action] = useFormState(addDependent, initialState);
  const shareCount = 1 + dependents.length;

  return (
    <section className="grid gap-4 rounded-md border border-border bg-raised p-5 shadow-card">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-heading">{t('title')}</h3>
          <p className="text-sm leading-6 text-secondary">{t('description')}</p>
        </div>
        <dl className="rounded-sm border border-border bg-sunken px-4 py-3 text-sm">
          <dt className="font-medium text-secondary">{t('shareCountLabel')}</dt>
          <dd className="mt-1 font-mono text-xl text-heading">{shareCount}</dd>
        </dl>
      </div>

      {dependents.length === 0 ? (
        <p className="rounded-sm border border-border bg-sunken p-4 text-sm text-secondary">{t('emptyState')}</p>
      ) : (
        <ul className="grid gap-3">
          {dependents.map((dependent) => (
            <li className="flex flex-col justify-between gap-3 rounded-sm border border-border bg-sunken p-4 md:flex-row md:items-center" key={dependent.id}>
              <div className="grid flex-1 gap-3">
                <p className="font-medium text-heading">{dependent.fullName}</p>
                <p className="text-sm text-secondary">{dependent.relationship}</p>
                {dependent.externalId === null || dependent.externalId.length === 0 ? null : <p className="mt-1 font-mono text-xs text-muted">{dependent.externalId}</p>}
                <UpdateDependentForm dependent={dependent} membershipId={membershipId} />
              </div>
              <RemoveDependentForm dependentId={dependent.id} membershipId={membershipId} />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid gap-4 rounded-sm border border-border bg-sunken p-4">
        <input name="membershipId" type="hidden" value={membershipId} />
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-secondary">
            {t('fullNameLabel')}
            <input className="rounded-sm border border-input bg-card px-3 py-2 text-body" maxLength={160} name="fullName" required type="text" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-secondary">
            {t('relationshipLabel')}
            <input className="rounded-sm border border-input bg-card px-3 py-2 text-body" maxLength={80} name="relationship" required type="text" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-secondary">
            {t('externalIdLabel')}
            <input className="rounded-sm border border-input bg-card px-3 py-2 text-body" maxLength={120} name="externalId" type="text" />
          </label>
        </div>
        <AddSubmitButton />
        {state.ok ? null : (
          <p className="text-sm font-medium text-negative">
            {t(`errors.${state.code}`)} ({state.code})
          </p>
        )}
      </form>
    </section>
  );
}
