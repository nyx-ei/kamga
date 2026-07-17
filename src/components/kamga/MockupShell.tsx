import { BarChart3, FileUp, List, PlusCircle, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

type PrototypeMode = 'lookup' | 'admin' | 'association';

type PrototypeTopbarProps = {
  activeMode: PrototypeMode;
  tabs?: Array<{
    active?: boolean;
    href: string;
    label: string;
  }>;
};

type PublicDirectoryHeaderProps = {
  locale: 'en' | 'fr';
};

type AdminWorkspaceShellProps = {
  activeItem: 'directory' | 'add' | 'csv' | 'metrics';
  activeTab?: 'add' | 'csv';
  children: ReactNode;
  title: string;
  toolbar?: ReactNode;
};

type AssociationWorkspaceShellProps = {
  activeTab: 'self-registration' | 'claim';
  children: ReactNode;
  locale: 'en' | 'fr';
};

function modeClassName(mode: PrototypeMode, activeMode: PrototypeMode): string {
  return mode === activeMode ? 'bg-brand text-heading shadow-card' : 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white';
}

export function PrototypeTopbar({ activeMode, tabs = [] }: PrototypeTopbarProps) {
  return (
    <header className="bg-[#111936] text-white">
      <div className="flex min-h-[68px] items-center justify-between gap-6 px-8">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-semibold">Kamga</span>
          <span className="text-sm font-semibold uppercase text-brand">LAYER 1 - LOOKUP PROTOTYPE</span>
        </div>
        <nav aria-label="Prototype modes" className="flex rounded-full bg-white/5 p-1">
          <Link className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${modeClassName('lookup', activeMode)}`} href="/">
            <Search aria-hidden="true" size={17} />
            User - public lookup
          </Link>
          <Link className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${modeClassName('admin', activeMode)}`} href="/admin">
            <SlidersHorizontal aria-hidden="true" size={17} />
            Admin - data entry
          </Link>
          <Link
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${modeClassName('association', activeMode)}`}
            href="/register"
          >
            <ShieldCheck aria-hidden="true" size={17} />
            Association - register & claim
          </Link>
        </nav>
      </div>
      {tabs.length > 0 ? (
        <nav aria-label="Prototype section" className="flex h-[60px] items-end gap-6 bg-[#23336d] px-8">
          {tabs.map((tab) => (
            <Link
              className={`border-b-2 px-3 pb-4 text-sm font-semibold transition ${
                tab.active ? 'border-brand text-white' : 'border-transparent text-white/65 hover:text-white'
              }`}
              href={tab.href}
              key={tab.label}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function PublicDirectoryHeader({ locale }: PublicDirectoryHeaderProps) {
  return (
    <section className="flex min-h-[84px] items-center justify-between border-b border-border bg-card px-8">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-heading">Kamga</span>
        <span className="text-base font-semibold text-secondary">RPN directory</span>
      </div>
      <div className="flex items-center gap-8">
        <Link className="text-sm font-semibold text-heading hover:text-link" href="/">
          Find an association
        </Link>
        <a className="text-sm font-semibold text-secondary hover:text-heading" href="#directory-about">
          About the directory
        </a>
        <div className="inline-flex rounded-full border border-border bg-card p-0.5">
          <Link className={`rounded-full px-4 py-2 text-sm font-semibold ${locale === 'en' ? 'bg-blue-900 text-white' : 'text-secondary'}`} href="/" locale="en">
            EN
          </Link>
          <Link className={`rounded-full px-4 py-2 text-sm font-semibold ${locale === 'fr' ? 'bg-blue-900 text-white' : 'text-secondary'}`} href="/" locale="fr">
            FR
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AdminWorkspaceShell({ activeItem, activeTab = 'add', children, title, toolbar }: AdminWorkspaceShellProps) {
  const itemClassName = (item: AdminWorkspaceShellProps['activeItem']) =>
    `flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-semibold transition ${
      activeItem === item ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-page text-body">
      <PrototypeTopbar
        activeMode="admin"
        tabs={[
          { active: activeTab === 'add', href: '/admin/associations', label: 'Add association' },
          { active: activeTab === 'csv', href: '/admin', label: 'CSV import' }
        ]}
      />
      <div className="grid min-h-[calc(100vh-128px)] grid-cols-1 lg:grid-cols-[348px_1fr]">
        <aside className="hidden flex-col bg-blue-900 px-4 py-9 text-white lg:flex">
          <div className="mb-12 flex items-baseline gap-3 px-5">
            <span className="text-2xl font-semibold">Kamga</span>
            <span className="text-sm font-semibold uppercase text-brand">ADMIN</span>
          </div>
          <nav className="grid gap-2">
            <Link className={itemClassName('directory')} href="/admin">
              <List aria-hidden="true" size={20} />
              Directory
            </Link>
            <Link className={itemClassName('add')} href="/admin/associations">
              <PlusCircle aria-hidden="true" size={20} />
              Add association
            </Link>
            <Link className={itemClassName('csv')} href="/admin">
              <FileUp aria-hidden="true" size={20} />
              CSV import
            </Link>
            <Link className={itemClassName('metrics')} href="/admin/levees">
              <BarChart3 aria-hidden="true" size={20} />
              Metrics
            </Link>
          </nav>
          <div className="mt-auto border-t border-white/15 pt-5">
            <div className="flex items-center gap-4 px-5">
              <span className="grid size-12 place-items-center rounded-full bg-brand text-sm font-semibold text-heading">RN</span>
              <span>
                <span className="block text-sm font-semibold">RPN staff</span>
                <span className="block text-xs text-white/65">admin@rpn.ca</span>
              </span>
            </div>
          </div>
        </aside>
        <main>
          <header className="flex min-h-[84px] items-center justify-between border-b border-border bg-card px-6 lg:px-9">
            <h1 className="text-3xl font-semibold text-heading">{title}</h1>
            {toolbar}
          </header>
          <div className="px-6 py-9 lg:px-9">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AssociationWorkspaceShell({ activeTab, children, locale }: AssociationWorkspaceShellProps) {
  return (
    <main className="min-h-screen bg-page text-body">
      <PrototypeTopbar
        activeMode="association"
        tabs={[
          { active: activeTab === 'self-registration', href: '/register', label: 'Self-registration' },
          { active: activeTab === 'claim', href: '/register?claim=1', label: 'Claim a listing' }
        ]}
      />
      <PublicDirectoryHeader locale={locale} />
      <div className="mx-auto max-w-6xl px-6 py-16">{children}</div>
    </main>
  );
}
