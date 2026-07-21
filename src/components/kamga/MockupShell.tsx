import { BarChart3, Bell, Building2, CreditCard, FileText, FileUp, HandCoins, Link2, List, Mail, ReceiptText, Rocket, ShieldCheck, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/kamga/LocaleSwitcher';
import { LogoutButton } from '@/features/auth';
import { Link } from '@/i18n/navigation';

type PublicDirectoryHeaderProps = {
  locale: 'en' | 'fr';
};

type AdminWorkspaceShellProps = {
  activeItem: 'associations' | 'connectRequests' | 'csv' | 'fees' | 'levees' | 'members' | 'notifications' | 'pilot' | 'referrals' | 'reports';
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
  activeItem: 'applications' | 'associations' | 'contributions' | 'notifications' | 'payments' | 'receipts' | 'relatives';
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
    adminAssociations: 'Associations',
    adminConnectRequests: 'Connect requests',
    adminCsv: 'CSV import',
    adminFees: 'Admin fees',
    adminLevees: 'Levees',
    adminMembers: 'Members',
    adminNotifications: 'Notifications',
    adminPilot: 'Pilot program',
    adminReferrals: 'Referrals',
    adminReports: 'Reports',
    findAssociation: 'Find an association',
    member: 'Member',
    memberApplications: 'Applications',
    memberAssociations: 'Associations',
    memberContributions: 'Contributions',
    memberNotifications: 'Notifications',
    memberPayments: 'Payments',
    memberReceipts: 'Tax receipts',
    memberRelatives: 'Relatives',
    rpnDirectory: 'RPN directory'
  },
  fr: {
    aboutDirectory: "À propos de l'annuaire",
    admin: 'Admin',
    adminAssociations: 'Associations',
    adminConnectRequests: 'Demandes contact',
    adminCsv: 'Import CSV',
    adminFees: 'Frais admin',
    adminLevees: 'Levées',
    adminMembers: 'Membres',
    adminNotifications: 'Notifications',
    adminPilot: 'Programme pilote',
    adminReferrals: 'Parrainages',
    adminReports: 'Rapports',
    findAssociation: 'Trouver une association',
    member: 'Membre',
    memberApplications: 'Demandes',
    memberAssociations: 'Associations',
    memberContributions: 'Contributions',
    memberNotifications: 'Notifications',
    memberPayments: 'Paiements',
    memberReceipts: 'Reçus fiscaux',
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
            <Link className={itemClassName('associations')} href="/admin/associations">
              <List aria-hidden="true" size={20} />
              {copy.adminAssociations}
            </Link>
            <Link className={itemClassName('csv')} href="/admin/csv">
              <FileUp aria-hidden="true" size={20} />
              {copy.adminCsv}
            </Link>
            <Link className={itemClassName('members')} href="/admin/members">
              <UsersRound aria-hidden="true" size={20} />
              {copy.adminMembers}
            </Link>
            <Link className={itemClassName('connectRequests')} href="/admin/connect-requests">
              <Mail aria-hidden="true" size={20} />
              {copy.adminConnectRequests}
            </Link>
            <Link className={itemClassName('referrals')} href="/admin/referrals">
              <Link2 aria-hidden="true" size={20} />
              {copy.adminReferrals}
            </Link>
            <Link className={itemClassName('pilot')} href="/admin/pilot">
              <Rocket aria-hidden="true" size={20} />
              {copy.adminPilot}
            </Link>
            <Link className={itemClassName('levees')} href="/admin/levees">
              <HandCoins aria-hidden="true" size={20} />
              {copy.adminLevees}
            </Link>
            <Link className={itemClassName('fees')} href="/admin/fees">
              <ReceiptText aria-hidden="true" size={20} />
              {copy.adminFees}
            </Link>
            <Link className={itemClassName('reports')} href="/admin/reports">
              <ShieldCheck aria-hidden="true" size={20} />
              {copy.adminReports}
            </Link>
            <Link className={itemClassName('notifications')} href="/admin/notifications">
              <Bell aria-hidden="true" size={20} />
              {copy.adminNotifications}
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
          <section className="border-b border-white/10 bg-blue-900 px-4 py-4 text-white lg:hidden">
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-semibold">Kamga</span>
              <span className="text-xs font-semibold uppercase text-brand">ADMIN</span>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <Link className={`${itemClassName('associations')} min-w-fit`} href="/admin/associations">
                <List aria-hidden="true" size={18} />
                {copy.adminAssociations}
              </Link>
              <Link className={`${itemClassName('csv')} min-w-fit`} href="/admin/csv">
                <FileUp aria-hidden="true" size={18} />
                {copy.adminCsv}
              </Link>
              <Link className={`${itemClassName('members')} min-w-fit`} href="/admin/members">
                <UsersRound aria-hidden="true" size={18} />
                {copy.adminMembers}
              </Link>
              <Link className={`${itemClassName('connectRequests')} min-w-fit`} href="/admin/connect-requests">
                <Mail aria-hidden="true" size={18} />
                {copy.adminConnectRequests}
              </Link>
              <Link className={`${itemClassName('referrals')} min-w-fit`} href="/admin/referrals">
                <Link2 aria-hidden="true" size={18} />
                {copy.adminReferrals}
              </Link>
              <Link className={`${itemClassName('pilot')} min-w-fit`} href="/admin/pilot">
                <Rocket aria-hidden="true" size={18} />
                {copy.adminPilot}
              </Link>
              <Link className={`${itemClassName('levees')} min-w-fit`} href="/admin/levees">
                <HandCoins aria-hidden="true" size={18} />
                {copy.adminLevees}
              </Link>
              <Link className={`${itemClassName('fees')} min-w-fit`} href="/admin/fees">
                <ReceiptText aria-hidden="true" size={18} />
                {copy.adminFees}
              </Link>
              <Link className={`${itemClassName('reports')} min-w-fit`} href="/admin/reports">
                <ShieldCheck aria-hidden="true" size={18} />
                {copy.adminReports}
              </Link>
              <Link className={`${itemClassName('notifications')} min-w-fit`} href="/admin/notifications">
                <Bell aria-hidden="true" size={18} />
                {copy.adminNotifications}
              </Link>
            </nav>
          </section>
          <header className="flex min-h-[84px] items-center justify-between border-b border-border bg-card px-6 lg:px-9">
            <h1 className="text-2xl font-semibold text-heading md:text-3xl">{title}</h1>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {toolbar}
              <LocaleSwitcher locale={locale} />
              <LogoutButton className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong" />
            </div>
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

export function MemberWorkspaceShell({ activeItem, children, locale, title, toolbar, userEmail }: MemberWorkspaceShellProps) {
  const copy = shellCopy[locale];
  const itemClassName = (item: MemberWorkspaceShellProps['activeItem']) =>
    `flex items-center gap-3 rounded-sm px-4 py-3 text-sm font-semibold transition ${
      activeItem === item ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-page text-body">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[348px_1fr]">
        <aside className="hidden flex-col bg-blue-900 px-4 py-9 text-white lg:flex">
          <div className="mb-12 flex items-baseline gap-3 px-5">
            <span className="text-2xl font-semibold">Kamga</span>
            <span className="text-sm font-semibold uppercase text-brand">MEMBER</span>
          </div>
          <nav className="grid gap-2">
            <Link className={itemClassName('applications')} href="/dashboard/applications">
              <List aria-hidden="true" size={20} />
              {copy.memberApplications}
            </Link>
            <Link className={itemClassName('associations')} href="/dashboard/associations">
              <Building2 aria-hidden="true" size={20} />
              {copy.memberAssociations}
            </Link>
            <Link className={itemClassName('contributions')} href="/dashboard/contributions">
              <BarChart3 aria-hidden="true" size={20} />
              {copy.memberContributions}
            </Link>
            <Link className={itemClassName('relatives')} href="/dashboard/relatives">
              <UsersRound aria-hidden="true" size={20} />
              {copy.memberRelatives}
            </Link>
            <Link className={itemClassName('payments')} href="/dashboard/payments">
              <CreditCard aria-hidden="true" size={20} />
              {copy.memberPayments}
            </Link>
            <Link className={itemClassName('notifications')} href="/dashboard/notifications">
              <Bell aria-hidden="true" size={20} />
              {copy.memberNotifications}
            </Link>
            <Link className={itemClassName('receipts')} href="/dashboard/receipts">
              <FileText aria-hidden="true" size={20} />
              {copy.memberReceipts}
            </Link>
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
          <section className="border-b border-white/10 bg-blue-900 px-4 py-4 text-white lg:hidden">
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-semibold">Kamga</span>
              <span className="text-xs font-semibold uppercase text-brand">MEMBER</span>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <Link className={`${itemClassName('applications')} min-w-fit`} href="/dashboard/applications">
                <List aria-hidden="true" size={18} />
                {copy.memberApplications}
              </Link>
              <Link className={`${itemClassName('associations')} min-w-fit`} href="/dashboard/associations">
                <Building2 aria-hidden="true" size={18} />
                {copy.memberAssociations}
              </Link>
              <Link className={`${itemClassName('contributions')} min-w-fit`} href="/dashboard/contributions">
                <BarChart3 aria-hidden="true" size={18} />
                {copy.memberContributions}
              </Link>
              <Link className={`${itemClassName('relatives')} min-w-fit`} href="/dashboard/relatives">
                <UsersRound aria-hidden="true" size={18} />
                {copy.memberRelatives}
              </Link>
              <Link className={`${itemClassName('payments')} min-w-fit`} href="/dashboard/payments">
                <CreditCard aria-hidden="true" size={18} />
                {copy.memberPayments}
              </Link>
              <Link className={`${itemClassName('notifications')} min-w-fit`} href="/dashboard/notifications">
                <Bell aria-hidden="true" size={18} />
                {copy.memberNotifications}
              </Link>
              <Link className={`${itemClassName('receipts')} min-w-fit`} href="/dashboard/receipts">
                <FileText aria-hidden="true" size={18} />
                {copy.memberReceipts}
              </Link>
            </nav>
          </section>
          <header className="flex min-h-[84px] items-center justify-between border-b border-border bg-card px-6 lg:px-9">
            <h1 className="text-2xl font-semibold text-heading md:text-3xl">{title}</h1>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {toolbar}
              <LocaleSwitcher locale={locale} />
              <LogoutButton className="inline-flex w-fit items-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium text-body shadow-card transition hover:border-border-strong" />
            </div>
          </header>
          <div className="px-6 py-9 lg:px-9">{children}</div>
        </main>
      </div>
    </div>
  );
}
