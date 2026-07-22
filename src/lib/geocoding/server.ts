import { env } from '@/lib/env/server-env';

import 'server-only';

type GeocodeInput = {
  city: string;
  postalCode: string;
  province: string;
  streetAddress: string | null;
};

type GeocodeSuccess = {
  latitude: number;
  longitude: number;
  provider: string;
  query: string;
  status: 'geocoded';
};

type GeocodeFailure = {
  latitude: null;
  longitude: null;
  provider: string;
  query: string;
  status: 'needs_review';
};

export type GeocodeResult = GeocodeFailure | GeocodeSuccess;

const GEOCODING_TIMEOUT_MS = 6000;

function buildQuery(input: GeocodeInput): string {
  return [input.streetAddress, input.city, input.province, input.postalCode, 'Canada']
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(', ');
}

function failedResult(provider: string, query: string): GeocodeFailure {
  return {
    latitude: null,
    longitude: null,
    provider,
    query,
    status: 'needs_review'
  };
}

function parseCoordinate(value: unknown): number | null {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number.parseFloat(String(value)) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeWithMapbox(query: string): Promise<GeocodeResult> {
  if (env.MAPBOX_GEOCODING_TOKEN === undefined) {
    return failedResult('mapbox', query);
  }

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', env.MAPBOX_GEOCODING_TOKEN);
  url.searchParams.set('country', 'CA');
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'address,postcode,place,locality,neighborhood');

  try {
    const response = await fetchWithTimeout(url.toString(), { headers: { accept: 'application/json' } });
    if (!response.ok) {
      return failedResult('mapbox', query);
    }

    const body = await response.json() as { features?: Array<{ center?: [number, number] }> };
    const center = body.features?.[0]?.center;
    if (center === undefined) {
      return failedResult('mapbox', query);
    }

    const longitude = parseCoordinate(center[0]);
    const latitude = parseCoordinate(center[1]);
    if (latitude === null || longitude === null) {
      return failedResult('mapbox', query);
    }

    return { latitude, longitude, provider: 'mapbox', query, status: 'geocoded' };
  } catch {
    return failedResult('mapbox', query);
  }
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResult> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('countrycodes', 'ca');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  try {
    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': env.GEOCODING_USER_AGENT ?? `Kamga/${env.NEXT_PUBLIC_APP_URL}`
      }
    });
    if (!response.ok) {
      return failedResult('nominatim', query);
    }

    const body = await response.json() as Array<{ lat?: string; lon?: string }>;
    const first = body[0];
    if (first === undefined) {
      return failedResult('nominatim', query);
    }

    const latitude = parseCoordinate(first.lat);
    const longitude = parseCoordinate(first.lon);
    if (latitude === null || longitude === null) {
      return failedResult('nominatim', query);
    }

    return { latitude, longitude, provider: 'nominatim', query, status: 'geocoded' };
  } catch {
    return failedResult('nominatim', query);
  }
}

export async function geocodeAssociationAddress(input: GeocodeInput): Promise<GeocodeResult> {
  const query = buildQuery(input);
  const provider = env.GEOCODING_PROVIDER ?? (env.MAPBOX_GEOCODING_TOKEN === undefined ? 'nominatim' : 'mapbox');

  if (provider === 'mapbox') {
    return geocodeWithMapbox(query);
  }

  return geocodeWithNominatim(query);
}

export function geocodeUpdate(result: GeocodeResult) {
  return {
    geocode_provider: result.provider,
    geocode_query: result.query,
    geocode_status: result.status,
    geocoded_at: result.status === 'geocoded' ? new Date().toISOString() : null,
    latitude: result.latitude,
    longitude: result.longitude
  };
}