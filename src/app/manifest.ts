import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kamga',
    short_name: 'Kamga',
    description: 'Public RPN association lookup and contribution management foundation.',
    start_url: '/en',
    display: 'standalone',
    background_color: '#fff8de',
    theme_color: '#8ca9ff',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ]
  };
}