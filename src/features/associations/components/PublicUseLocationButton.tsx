'use client';

import { useState } from 'react';
import { Crosshair } from 'lucide-react';

type PublicUseLocationButtonProps = {
  label: string;
  locale: 'en' | 'fr';
  loadingLabel: string;
};

export function PublicUseLocationButton({ label, locale, loadingLabel }: PublicUseLocationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  function useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams(window.location.search);
        params.set('lat', String(position.coords.latitude));
        params.set('lng', String(position.coords.longitude));
        params.set('origin', 'device');
        params.set('page', '1');
        window.location.href = `/${locale}?${params.toString()}`;
      },
      () => {
        setIsLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  }

  return (
    <button
      className="inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-border bg-card px-5 text-sm font-semibold text-heading shadow-card transition hover:border-border-strong disabled:cursor-wait disabled:text-muted"
      disabled={isLoading}
      onClick={useCurrentLocation}
      type="button"
    >
      <Crosshair aria-hidden="true" size={18} />
      {isLoading ? loadingLabel : label}
    </button>
  );
}