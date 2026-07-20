import { MemberDashboardContent } from '@/app/[locale]/dashboard/member-dashboard-content';

type DashboardRelativesPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
  searchParams: {
    associationSubmitted?: string;
    joinRequest?: string;
    payment?: string;
    registration?: string;
  };
};

export default function DashboardRelativesPage({ params, searchParams }: DashboardRelativesPageProps) {
  return <MemberDashboardContent params={params} searchParams={searchParams} section="relatives" />;
}
