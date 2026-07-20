import { MemberDashboardContent } from '@/app/[locale]/dashboard/member-dashboard-content';

type DashboardReceiptsPageProps = {
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

export default function DashboardReceiptsPage({ params, searchParams }: DashboardReceiptsPageProps) {
  return <MemberDashboardContent params={params} searchParams={searchParams} section="receipts" />;
}
