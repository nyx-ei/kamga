import type { Metadata } from 'next';

import { publicEnv } from '@/lib/env/public-env';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: 'Kamga',
  description: 'RPN association lookup and contribution management platform.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
