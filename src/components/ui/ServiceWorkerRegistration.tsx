'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') {
      return;
    }

    void navigator.serviceWorker.register('/sw').then((registration) => {
      const locale = window.location.pathname.match(/^\/(en|fr)(\/|$)/)?.[1] ?? 'en';
      const contributionUrl = `/${locale}/dashboard/contributions`;
      const offlineUrl = `/${locale}/offline`;

      if (registration.active !== null) {
        registration.active.postMessage({
          type: 'CACHE_URLS',
          urls: [offlineUrl, contributionUrl]
        });
      }
    });
  }, []);

  return null;
}
