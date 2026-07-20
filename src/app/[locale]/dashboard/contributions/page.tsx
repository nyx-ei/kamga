import { MemberDashboardContent } from '@/app/[locale]/dashboard/member-dashboard-content';

type DashboardContributionsPageProps = {
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

export default function DashboardContributionsPage({ params, searchParams }: DashboardContributionsPageProps) {
  return <MemberDashboardContent params={params} searchParams={searchParams} section="contributions" />;
}
