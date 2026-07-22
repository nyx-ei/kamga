import { env } from '@/lib/env/server-env';

import 'server-only';

export type RegistryType = 'federal' | 'neq';
export type RegistryVerificationStatus = 'needs_review' | 'unverified' | 'verified';

export type RegistryVerificationResult = {
  checkedAt: string | null;
  confidence: number | null;
  matchedName: string | null;
  provider: string | null;
  reason: string;
  status: RegistryVerificationStatus;
};

type RegistryDatasetRecord = {
  active?: boolean;
  legalName?: string;
  name?: string;
  names?: string[];
  number?: string;
  registryNumber?: string;
  registryType?: RegistryType;
  status?: string;
};

const REGISTRY_TIMEOUT_MS = 6000;
const VERIFIED_THRESHOLD = 0.82;
const REVIEW_THRESHOLD = 0.62;

function normalizeRegistryNumber(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.replace(/[^A-Za-z0-9]/gu, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function bigrams(value: string): Set<string> {
  const normalized = normalizeText(value).replace(/\s+/gu, '');

  if (normalized.length < 2) {
    return new Set(normalized.length === 0 ? [] : [normalized]);
  }

  const pairs = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    pairs.add(normalized.slice(index, index + 2));
  }

  return pairs;
}

function similarity(left: string, right: string): number {
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);

  if (leftPairs.size === 0 || rightPairs.size === 0) {
    return 0;
  }

  const intersection = [...leftPairs].filter((pair) => rightPairs.has(pair)).length;
  const union = new Set([...leftPairs, ...rightPairs]).size;
  return union === 0 ? 0 : intersection / union;
}

function registryDatasetUrl(registryType: RegistryType): string | null {
  if (registryType === 'neq') {
    return env.REQ_REGISTRY_DATA_URL ?? null;
  }

  return env.FEDERAL_REGISTRY_DATA_URL ?? null;
}

function inferActive(record: RegistryDatasetRecord): boolean {
  if (typeof record.active === 'boolean') {
    return record.active;
  }

  const status = normalizeText(record.status ?? '');
  return ['active', 'actif', 'immatriculee', 'immatricule', 'registered'].includes(status);
}

function recordNames(record: RegistryDatasetRecord): string[] {
  const names = [record.legalName, record.name, ...(record.names ?? [])]
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

  return [...new Set(names)];
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function emptyResult(status: RegistryVerificationStatus, reason: string): RegistryVerificationResult {
  return {
    checkedAt: status === 'needs_review' ? null : new Date().toISOString(),
    confidence: null,
    matchedName: null,
    provider: null,
    reason,
    status
  };
}

async function loadRegistryRecord(params: { registryNumber: string; registryType: RegistryType }): Promise<{ provider: string; record: RegistryDatasetRecord } | null> {
  const datasetUrl = registryDatasetUrl(params.registryType);

  if (datasetUrl === null) {
    return null;
  }

  const url = new URL(datasetUrl);
  url.searchParams.set('number', params.registryNumber);
  url.searchParams.set('registryType', params.registryType);

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    return null;
  }

  const body = await response.json() as unknown;
  const record = Array.isArray(body)
    ? body[0] as RegistryDatasetRecord | undefined
    : typeof body === 'object' && body !== null && 'record' in body
      ? (body as { record?: RegistryDatasetRecord }).record
      : body as RegistryDatasetRecord;

  if (record === undefined || record === null) {
    return null;
  }

  return { provider: datasetUrl, record };
}

export async function verifyAssociationRegistry(params: {
  officialName: string;
  registryNumber: string | null;
  registryType: RegistryType | null;
}): Promise<RegistryVerificationResult> {
  const registryNumber = normalizeRegistryNumber(params.registryNumber);

  if (registryNumber === null) {
    return emptyResult('unverified', 'missing_registry_number');
  }

  if (params.registryType === null) {
    return emptyResult('needs_review', 'missing_registry_type');
  }

  try {
    const match = await loadRegistryRecord({ registryNumber, registryType: params.registryType });

    if (match === null) {
      return emptyResult('needs_review', 'registry_provider_unavailable');
    }

    const recordNumber = normalizeRegistryNumber(match.record.registryNumber ?? match.record.number ?? null);
    if (recordNumber !== registryNumber) {
      return {
        checkedAt: new Date().toISOString(),
        confidence: null,
        matchedName: null,
        provider: match.provider,
        reason: 'registry_number_not_found',
        status: 'unverified'
      };
    }

    if (!inferActive(match.record)) {
      return {
        checkedAt: new Date().toISOString(),
        confidence: null,
        matchedName: recordNames(match.record)[0] ?? null,
        provider: match.provider,
        reason: 'registry_entity_inactive',
        status: 'needs_review'
      };
    }

    const candidates = recordNames(match.record);
    const best = candidates
      .map((name) => ({ name, score: similarity(params.officialName, name) }))
      .sort((left, right) => right.score - left.score)[0];

    if (best === undefined) {
      return {
        checkedAt: new Date().toISOString(),
        confidence: null,
        matchedName: null,
        provider: match.provider,
        reason: 'registry_name_missing',
        status: 'needs_review'
      };
    }

    if (best.score >= VERIFIED_THRESHOLD) {
      return {
        checkedAt: new Date().toISOString(),
        confidence: best.score,
        matchedName: best.name,
        provider: match.provider,
        reason: 'registry_match_active_name_match',
        status: 'verified'
      };
    }

    return {
      checkedAt: new Date().toISOString(),
      confidence: best.score,
      matchedName: best.name,
      provider: match.provider,
      reason: best.score >= REVIEW_THRESHOLD ? 'registry_name_match_needs_review' : 'registry_name_mismatch',
      status: best.score >= REVIEW_THRESHOLD ? 'needs_review' : 'unverified'
    };
  } catch {
    return emptyResult('needs_review', 'registry_check_failed');
  }
}

export function registryVerificationUpdate(result: RegistryVerificationResult) {
  return {
    registry_checked_at: result.checkedAt,
    registry_match_confidence: result.confidence,
    registry_matched_name: result.matchedName,
    registry_provider: result.provider,
    registry_verification_reason: result.reason,
    verification_status: result.status
  };
}
