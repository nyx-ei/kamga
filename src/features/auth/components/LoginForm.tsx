'use client';

import { type FormEvent,useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Chrome, Mail, Users } from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';

type LoginFormProps = {
  nextPath?: string;
};

const OAUTH_PROVIDERS = ['google', 'facebook'] as const;

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function LoginForm({ nextPath }: LoginFormProps) {
  const t = useTranslations('auth.login');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [provider, setProvider] = useState<OAuthProvider | null>(null);
  const supabase = createSupabaseBrowserClient();

  function authRedirectUrl(): string {
    const nextQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    return `${window.location.origin}/${locale}/auth/callback${nextQuery}`;
  }

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('loading');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: authRedirectUrl()
      }
    });

    setStatus(error === null ? 'sent' : 'error');
  }

  async function handleOAuthSignIn(selectedProvider: OAuthProvider) {
    setProvider(selectedProvider);
    setStatus('loading');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: selectedProvider,
      options: {
        redirectTo: authRedirectUrl()
      }
    });

    if (error !== null) {
      setProvider(null);
      setStatus('error');
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-card">
      <form className="flex flex-col gap-4" onSubmit={handleMagicLinkSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-body" htmlFor="email">
            {t('emailLabel')}
          </label>
          <input
            className="rounded-sm border border-input bg-raised px-3 py-2 text-sm text-body outline-none transition focus:border-focus"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailPlaceholder')}
            required
            type="email"
            value={email}
          />
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:text-disabled"
          disabled={status === 'loading'}
          type="submit"
        >
          <Mail aria-hidden="true" size={16} />
          {status === 'loading' && provider === null ? t('sending') : t('magicLinkAction')}
        </button>
        {status === 'sent' ? <p className="text-sm text-positive">{t('sentMessage')}</p> : null}
        {status === 'error' ? <p className="text-sm text-negative">{t('errorMessage')}</p> : null}
      </form>

      <div className="my-6 h-px bg-border" />

      <div className="flex flex-col gap-3">
        <button
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong',
            status === 'loading' ? 'cursor-not-allowed text-disabled' : null
          )}
          disabled={status === 'loading'}
          onClick={() => void handleOAuthSignIn('google')}
          type="button"
        >
          <Chrome aria-hidden="true" size={16} />
          {provider === 'google' ? t('connecting') : t('googleAction')}
        </button>
        <button
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-raised px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong',
            status === 'loading' ? 'cursor-not-allowed text-disabled' : null
          )}
          disabled={status === 'loading'}
          onClick={() => void handleOAuthSignIn('facebook')}
          type="button"
        >
          <Users aria-hidden="true" size={16} />
          {provider === 'facebook' ? t('connecting') : t('facebookAction')}
        </button>
      </div>
    </div>
  );
}