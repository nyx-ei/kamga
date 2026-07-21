import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export function GET(_request: NextRequest): Response {
  const serviceWorker = `
const CACHE_NAME = 'kamga-pwa-v2';
const STATIC_CACHE_NAME = 'kamga-static-v2';
const SHELL_ROUTES = ['/en', '/fr', '/en/offline', '/fr/offline'];

function localeFromUrl(url) {
  const match = new URL(url).pathname.match(/^\\/(en|fr)(\\/|$)/);
  return match ? match[1] : 'en';
}

function offlineUrlFor(requestUrl) {
  return '/' + localeFromUrl(requestUrl) + '/offline';
}

function isContributionNavigation(request) {
  return request.mode === 'navigate' && /^\\/(en|fr)\\/dashboard\\/contributions/.test(new URL(request.url).pathname);
}

function isAppNavigation(request) {
  return request.mode === 'navigate' && /^\\/(en|fr)(\\/|$)/.test(new URL(request.url).pathname);
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/_next/static/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/icon.svg';
}

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

  if (isStaticAsset(event.request)) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);

        if (cached) {
          return cached;
        }

        const response = await fetch(event.request);

        if (response.ok) {
          await cache.put(event.request, response.clone());
        }

        return response;
      })
    );
    return;
  }

  if (isContributionNavigation(event.request) || isAppNavigation(event.request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(event.request);

          if (response.ok) {
            await cache.put(event.request, response.clone());
          }

          return response;
        } catch {
          return (await cache.match(event.request)) || (await cache.match(offlineUrlFor(event.request.url))) || Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Kamga';
  const options = {
    body: payload.body || '',
    data: {
      url: payload.url || '/en/dashboard/notifications'
    },
    icon: '/icon.svg',
    tag: payload.tag || 'kamga-notification'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/en/dashboard/notifications', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url === targetUrl);

      if (matchingClient) {
        return matchingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(event.data.urls)));
  }

  if (event.data?.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(event.data.title || 'Kamga', {
        body: event.data.body || '',
        data: { url: event.data.url || '/en/dashboard/notifications' },
        icon: '/icon.svg',
        tag: event.data.tag || 'kamga-local-notification'
      })
    );
  }
});
`;

  return new Response(serviceWorker, {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'application/javascript; charset=utf-8'
    }
  });
}
