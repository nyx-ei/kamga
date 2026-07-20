import { redirect } from 'next/navigation';

type AdminPageProps = {
  params: {
    locale: 'en' | 'fr';
  };
};

export default function AdminPage({ params }: AdminPageProps) {
  redirect(`/${params.locale}/admin/associations`);
}
