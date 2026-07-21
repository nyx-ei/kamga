import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/en',
    name: 'Kamga',
    short_name: 'Kamga',
    description: 'Public RPN association lookup and contribution management foundation.',
    start_url: '/en',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#fff8de',
    theme_color: '#8ca9ff',
    categories: ['finance', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ],
    shortcuts: [
      {
        name: 'Member contributions',
        short_name: 'Contributions',
        description: 'Open the offline-friendly contribution view.',
        url: '/en/dashboard/contributions',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
      },
      {
        name: 'Notifications',
        short_name: 'Notifications',
        description: 'Open Kamga notifications.',
        url: '/en/dashboard/notifications',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
      }
    ]
  };
}
