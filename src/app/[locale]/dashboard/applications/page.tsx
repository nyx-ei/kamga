import { MemberDashboardContent } from '@/app/[locale]/dashboard/member-dashboard-content';

type DashboardApplicationsPageProps = {
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

export default function DashboardApplicationsPage({ params, searchParams }: DashboardApplicationsPageProps) {
  return <MemberDashboardContent params={params} searchParams={searchParams} section="applications" />;
}
