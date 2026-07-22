'use client';

import { useMemo, useState } from 'react';
import { Layers, LocateFixed, Minus, Plus } from 'lucide-react';

import type { PublicAssociationSearchResult } from '@/features/associations/public-search';

type PublicDirectoryMapCopy = {
  areaGroup: (count: number) => string;
  clusterAction: string;
  clusterLabel: (count: number) => string;
  locationOnlyMap: string;
  mapPrecision: string;
  mapTitle: string;
  selectedLabel: string;
  zoomIn: string;
  zoomOut: string;
};

type PublicDirectoryMapProps = {
  associations: PublicAssociationSearchResult[];
  copy: PublicDirectoryMapCopy;
  locale: 'en' | 'fr';
  pageSize: number;
  selectedAssociationId: string | null;
  urlParams: Record<string, string>;
};

type ProjectedAssociation = PublicAssociationSearchResult & {
  left: number;
  top: number;
};

type MapCluster = {
  id: string;
  items: ProjectedAssociation[];
  left: number;
  top: number;
  type: 'cluster' | 'marker' | 'shared-area';
};

function projectAssociations(associations: PublicAssociationSearchResult[]): ProjectedAssociation[] {
  if (associations.length === 0) {
    return [];
  }

  const latitudes = associations.map((item) => item.latitude);
  const longitudes = associations.map((item) => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);

  return associations.map((association) => ({
    ...association,
    left: maxLon === minLon ? 50 : 12 + ((association.longitude - minLon) / (maxLon - minLon)) * 76,
    top: maxLat === minLat ? 50 : 12 + ((maxLat - association.latitude) / (maxLat - minLat)) * 76
  }));
}

function coordinateKey(association: PublicAssociationSearchResult): string {
  return `${association.latitude.toFixed(5)}:${association.longitude.toFixed(5)}:${association.publicPrecision}`;
}

function clusterAssociations(associations: PublicAssociationSearchResult[], zoom: number): MapCluster[] {
  const projected = projectAssociations(associations);
  const sharedCoordinateGroups = new Map<string, ProjectedAssociation[]>();
  const candidates: ProjectedAssociation[] = [];

  for (const association of projected) {
    const key = coordinateKey(association);
    const group = sharedCoordinateGroups.get(key) ?? [];
    group.push(association);
    sharedCoordinateGroups.set(key, group);
  }

  const fixedGroups: MapCluster[] = [];
  for (const [key, items] of sharedCoordinateGroups.entries()) {
    if (items.length > 1 || items[0]?.publicPrecision === 'neighbourhood') {
      fixedGroups.push({
        id: `area-${key}`,
        items,
        left: items.reduce((sum, item) => sum + item.left, 0) / items.length,
        top: items.reduce((sum, item) => sum + item.top, 0) / items.length,
        type: items.length > 1 ? 'shared-area' : 'marker'
      });
    } else if (items[0] !== undefined) {
      candidates.push(items[0]);
    }
  }

  const cellSize = zoom === 1 ? 18 : zoom === 2 ? 12 : zoom === 3 ? 8 : 5;
  const grid = new Map<string, ProjectedAssociation[]>();

  for (const item of candidates) {
    const cellX = Math.floor(item.left / cellSize);
    const cellY = Math.floor(item.top / cellSize);
    const key = `${cellX}:${cellY}`;
    const group = grid.get(key) ?? [];
    group.push(item);
    grid.set(key, group);
  }

  const clusters = [...grid.entries()].map(([key, items]) => ({
    id: `cluster-${key}`,
    items,
    left: items.reduce((sum, item) => sum + item.left, 0) / items.length,
    top: items.reduce((sum, item) => sum + item.top, 0) / items.length,
    type: items.length > 1 ? 'cluster' as const : 'marker' as const
  }));

  return [...fixedGroups, ...clusters].sort((left, right) => left.top - right.top || left.left - right.left);
}

function destinationForAssociation(locale: 'en' | 'fr', association: PublicAssociationSearchResult, pageSize: number, urlParams: Record<string, string>): string {
  const params = new URLSearchParams(urlParams);
  params.set('page', String(Math.max(1, Math.ceil(association.rank / pageSize))));
  params.set('selected', association.id);
  return `/${locale}?${params.toString()}#association-${association.id}`;
}

export function PublicDirectoryMap({ associations, copy, locale, pageSize, selectedAssociationId, urlParams }: PublicDirectoryMapProps) {
  const [zoom, setZoom] = useState(2);
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const clusters = useMemo(() => clusterAssociations(associations, zoom), [associations, zoom]);
  const openCluster = clusters.find((cluster) => cluster.id === openClusterId) ?? null;

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-md border border-border bg-[#eef3fb] shadow-card">
      <div className="absolute inset-0 bg-[linear-gradient(#dfe6f3_1px,transparent_1px),linear-gradient(90deg,#dfe6f3_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute left-5 top-5 z-10 rounded-sm border border-border bg-card/95 px-4 py-3 shadow-card">
        <p className="font-semibold text-heading">{copy.mapTitle}</p>
        <p className="mt-1 text-xs text-secondary">{copy.locationOnlyMap}</p>
      </div>

      <div className="absolute right-5 top-5 z-20 flex gap-2">
        <button
          aria-label={copy.zoomOut}
          className="grid size-10 place-items-center rounded-sm border border-border bg-card text-heading shadow-card disabled:cursor-not-allowed disabled:text-muted"
          disabled={zoom === 1}
          onClick={() => setZoom((value) => Math.max(1, value - 1))}
          type="button"
        >
          <Minus aria-hidden="true" size={17} />
        </button>
        <button
          aria-label={copy.zoomIn}
          className="grid size-10 place-items-center rounded-sm border border-border bg-card text-heading shadow-card disabled:cursor-not-allowed disabled:text-muted"
          disabled={zoom === 4}
          onClick={() => setZoom((value) => Math.min(4, value + 1))}
          type="button"
        >
          <Plus aria-hidden="true" size={17} />
        </button>
      </div>

      {associations.length === 0 ? (
        <div className="relative grid h-full min-h-[520px] place-items-center p-8 text-center">
          <p className="rounded-md border border-border bg-card/95 px-5 py-4 text-sm leading-6 text-secondary shadow-card">{copy.locationOnlyMap}</p>
        </div>
      ) : (
        clusters.map((cluster) => {
          const first = cluster.items[0];
          const isSelected = cluster.items.some((item) => item.id === selectedAssociationId);

          if (first === undefined) {
            return null;
          }

          if (cluster.items.length === 1 && cluster.type !== 'shared-area') {
            const href = destinationForAssociation(locale, first, pageSize, urlParams);
            const isNeighbourhood = first.publicPrecision === 'neighbourhood';

            return (
              <a
                aria-label={first.displayName}
                className={`absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center text-sm font-semibold transition hover:scale-105 ${isNeighbourhood ? 'size-14 rounded-full border-2 border-dashed border-[#314ca8] bg-[#4d67c7]/20 text-[#243a93]' : 'size-11 rounded-full border-2 border-[#314ca8] bg-[#4d67c7] text-white shadow-card'} ${isSelected ? 'ring-4 ring-brand/40' : ''}`}
                href={href}
                key={first.id}
                style={{ left: `${cluster.left}%`, top: `${cluster.top}%` }}
              >
                {first.rank}
              </a>
            );
          }

          return (
            <button
              aria-label={cluster.type === 'shared-area' ? copy.areaGroup(cluster.items.length) : copy.clusterLabel(cluster.items.length)}
              className={`absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-sm font-semibold shadow-card transition hover:scale-105 ${cluster.type === 'shared-area' ? 'size-14 border-dashed border-[#314ca8] bg-card text-[#243a93]' : 'size-12 border-[#314ca8] bg-[#4d67c7] text-white'} ${isSelected ? 'ring-4 ring-brand/40' : ''}`}
              key={cluster.id}
              onClick={() => setOpenClusterId((current) => current === cluster.id ? null : cluster.id)}
              style={{ left: `${cluster.left}%`, top: `${cluster.top}%` }}
              type="button"
            >
              {cluster.items.length}
            </button>
          );
        })
      )}

      {openCluster !== null ? (
        <div className="absolute bottom-16 left-5 right-5 z-30 rounded-md border border-border bg-card/95 p-4 shadow-card md:left-auto md:w-80">
          <div className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Layers aria-hidden="true" size={16} />
            {openCluster.type === 'shared-area' ? copy.areaGroup(openCluster.items.length) : copy.clusterLabel(openCluster.items.length)}
          </div>
          <div className="mt-3 grid gap-2">
            {openCluster.items.map((association) => (
              <a
                className="rounded-sm border border-border bg-sunken px-3 py-2 text-sm font-semibold text-heading transition hover:border-border-strong"
                href={destinationForAssociation(locale, association, pageSize, urlParams)}
                key={association.id}
              >
                {association.displayName}
                <span className="block text-xs font-normal text-secondary">{association.city}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {selectedAssociationId !== null ? (
        <div className="absolute bottom-16 left-5 z-20 inline-flex items-center gap-2 rounded-sm bg-card/95 px-3 py-2 text-xs font-semibold text-heading shadow-card">
          <LocateFixed aria-hidden="true" size={14} />
          {copy.selectedLabel}
        </div>
      ) : null}

      <p className="absolute bottom-4 right-4 rounded-sm bg-card/95 px-3 py-2 text-xs text-secondary shadow-card">{copy.mapPrecision}</p>
    </div>
  );
}