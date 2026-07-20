import { MemberDashboardContent } from '@/app/[locale]/dashboard/member-dashboard-content';

type DashboardPaymentsPageProps = {
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

export default function DashboardPaymentsPage({ params, searchParams }: DashboardPaymentsPageProps) {
  return <MemberDashboardContent params={params} searchParams={searchParams} section="payments" />;
}
