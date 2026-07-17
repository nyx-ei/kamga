import { BarChart3, Bell, CreditCard, FileText, FileUp, Home, List, PlusCircle, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/kamga/LocaleSwitcher';
import { Link } from '@/i18n/navigation';

type PublicDirectoryHeaderProps = {
  locale: 'en' | 'fr';
};

type AdminWorkspaceShellProps = {
  activeItem: 'directory' | 'add' | 'csv' | 'metrics';
  children: ReactNode;
  locale: 'en' | 'fr';
  title: string;
  toolbar?: ReactNode;
  userEmail?: string | null;
};

type AssociationWorkspaceShellProps = {
  children: ReactNode;
  locale: 'en' | 'fr';
};

type MemberWorkspaceShellProps = {
  children: ReactNode;
  locale: 'en' | 'fr';
  title: string;
  toolbar?: ReactNode;
  userEmail?: string | null;
};

const shellCopy = {
  en: {
    aboutDirectory: 'About the directory',
    admin: 'Admin',
    adminAdd: 'Add association',
    adminCsv: 'CSV import',
    adminDirectory: 'Directory',
    adminMetrics: 'Metrics',
    findAssociation: 'Find an association',
    member: 'Member',
    memberApplications: 'Applications',
    memberContributions: 'Contributions',
    memberNotifications: 'Notifications',
    memberOverview: 'Overview',
    memberPayments: 'Payments',
    memberReceipts: 'Tax receipts',
    memberRelatives: 'Relatives',
    rpnDirectory: 'RPN directory'
  },
  fr: {
    aboutDirectory: 'A propos de l annuaire',
    admin: 'Admin',
    adminAdd: 'Ajouter une association',
    adminCsv: 'Import CSV',
    adminDirectory: 'Annuaire',
    adminMetrics: 'Indicateurs',
    findAssociation: 'Trouver une association',
    member: 'Membre',
    memberApplications: 'Demandes',
    memberContributions: 'Contributions',
    memberNotifications: 'Notifications',
    memberOverview: 'Vue d ensemble',
    memberPayments: 'Paiements',
    memberReceipts: 'Recus fiscaux',
    memberRelatives: 'Proches',
    rpnDirectory: 'Annuaire RPN'
  }
} as const;

export function PublicDirectoryHeader({ locale }: PublicDirectoryHeaderProps) {
  const copy = shellCopy[locale];

  return (
    <section className="flex min-h-[84px] items-center justify-between border-b border-border bg-card px-8">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-heading">Kamga</span>
        <span className="text-base font-semibold text-secondary">{copy.rpnDirectory}</span>
      </div>
      <div className="flex items-center gap-8">
        <Link className="text-sm font-semibold text-heading hover:text-link" href="/">
          {copy.findAssociation}
        </Link>
        <a className="text-sm font-semibold text-secondary hover:text-heading" href="#directory-about">
          {copy.aboutDirectory}
        </a>
        <LocaleSwitcher locale={locale} />
      </div>
    </section>
  );
}

export function AdminWorkspaceShell({ activeItem, children, locale, title, toolbar, userEmail }: AdminWorkspaceShellProps) {
  const copy = shellCopy[locale];
  const itemClassName = (item: AdminWorkspaceShellProps['activeItem']) =>
    `flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-semibold transition ${
      activeItem === item ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-page text-body">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[348px_1fr]">
        <aside className="hidden flex-col bg-blue-900 px-4 py-9 text-white lg:flex">
          <div className="mb-12 flex items-baseline gap-3 px-5">
            <span className="text-2xl font-semibold">Kamga</span>
            <span className="text-sm font-semibold uppercase text-brand">ADMIN</span>
          </div>
          <nav className="grid gap-2">
            <Link className={itemClassName('directory')} href="/admin">
              <List aria-hidden="true" size={20} />
              {copy.adminDirectory}
            </Link>
            <Link className={itemClassName('add')} href="/admin/associations">
              <PlusCircle aria-hidden="true" size={20} />
              {copy.adminAdd}
            </Link>
            <Link className={itemClassName('csv')} href="/admin">
              <FileUp aria-hidden="true" size={20} />
              {copy.adminCsv}
            </Link>
            <Link className={itemClassName('metrics')} href="/admin/levees">
              <BarChart3 aria-hidden="true" size={20} />
              {copy.adminMetrics}
            </Link>
          </nav>
          <div className="mt-auto border-t border-white/15 pt-5">
            <div className="flex items-center gap-4 px-5">
              <span className="grid size-12 place-items-center rounded-full bg-brand text-sm font-semibold text-heading">AD</span>
              <span>
                <span className="block text-sm font-semibold">{copy.admin}</span>
                {userEmail !== null && userEmail !== undefined ? <span className="block text-xs text-white/65">{userEmail}</span> : null}
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

export function AssociationWorkspaceShell({ children, locale }: AssociationWorkspaceShellProps) {
  return (
    <main className="min-h-screen bg-page text-body">
      <PublicDirectoryHeader locale={locale} />
      <div className="mx-auto max-w-6xl px-6 py-16">{children}</div>
    </main>
  );
}

export function MemberWorkspaceShell({ children, locale, title, toolbar, userEmail }: MemberWorkspaceShellProps) {
  const copy = shellCopy[locale];
  const itemClassName = 'flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white';
  const activeItemClassName = 'flex items-center gap-3 rounded-sm bg-white/10 px-4 py-3 text-sm font-semibold text-white transition';

  return (
    <div className="min-h-screen bg-page text-body">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[348px_1fr]">
        <aside className="hidden flex-col bg-blue-900 px-4 py-9 text-white lg:flex">
          <div className="mb-12 flex items-baseline gap-3 px-5">
            <span className="text-2xl font-semibold">Kamga</span>
            <span className="text-sm font-semibold uppercase text-brand">MEMBER</span>
          </div>
          <nav className="grid gap-2">
            <a className={activeItemClassName} href="#overview">
              <Home aria-hidden="true" size={20} />
              {copy.memberOverview}
            </a>
            <a className={itemClassName} href="#applications">
              <List aria-hidden="true" size={20} />
              {copy.memberApplications}
            </a>
            <a className={itemClassName} href="#contributions">
              <BarChart3 aria-hidden="true" size={20} />
              {copy.memberContributions}
            </a>
            <a className={itemClassName} href="#relatives">
              <UsersRound aria-hidden="true" size={20} />
              {copy.memberRelatives}
            </a>
            <a className={itemClassName} href="#payments">
              <CreditCard aria-hidden="true" size={20} />
              {copy.memberPayments}
            </a>
            <a className={itemClassName} href="#notifications">
              <Bell aria-hidden="true" size={20} />
              {copy.memberNotifications}
            </a>
            <a className={itemClassName} href="#receipts">
              <FileText aria-hidden="true" size={20} />
              {copy.memberReceipts}
            </a>
          </nav>
          <div className="mt-auto border-t border-white/15 pt-5">
            <div className="flex items-center gap-4 px-5">
              <span className="grid size-12 place-items-center rounded-full bg-brand text-sm font-semibold text-heading">MB</span>
              <span>
                <span className="block text-sm font-semibold">{copy.member}</span>
                {userEmail !== null && userEmail !== undefined ? <span className="block text-xs text-white/65">{userEmail}</span> : null}
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
