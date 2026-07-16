import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export function GET(_request: NextRequest): Response {
  const serviceWorker = `
const CACHE_NAME = 'kamga-shell-v1';
const SHELL_ROUTES = ['/en', '/fr'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ROUTES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
`;

  return new Response(serviceWorker, {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'application/javascript; charset=utf-8'
    }
  });
}