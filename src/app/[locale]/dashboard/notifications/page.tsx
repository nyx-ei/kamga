import { MemberDashboardContent } from '@/app/[locale]/dashboard/member-dashboard-content';

type DashboardNotificationsPageProps = {
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

export default function DashboardNotificationsPage({ params, searchParams }: DashboardNotificationsPageProps) {
  return <MemberDashboardContent params={params} searchParams={searchParams} section="notifications" />;
}
