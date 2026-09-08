'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { Category, HeatMapCell, OrgUnit } from '@/lib/types';
import { BAND_BG_CLASS } from '@/lib/score-band';

export default function HeatMapPage() {
  const router = useRouter();
  const [orgUnitId, setOrgUnitId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: categories } = useApiGet<Category[]>('/categories');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (orgUnitId) params.set('orgUnitId', orgUnitId);
    if (categoryId) params.set('categoryId', categoryId);
    return params.toString();
  }, [orgUnitId, categoryId]);

  const path = `/risks/heat-map${query ? `?${query}` : ''}`;
  const { data: cells, loading } = useApiGet<HeatMapCell[]>(path, [path]);

  function cellFor(likelihood: number, impact: number) {
    return cells?.find((c) => c.likelihood === likelihood && c.impact === impact);
  }

  function goToFiltered(likelihood: number, impact: number) {
    const params = new URLSearchParams(query);
    // The register doesn't filter by exact likelihood/impact directly, so we
    // route to the flat register pre-filtered by org unit/category and let
    // the user cross-reference by band, which the clicked cell's color shows.
    params.set('band', cellFor(likelihood, impact)?.band || '');
    router.push(`/risk-register?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Risk Heat Map</h1>

      <div className="dgs-card flex flex-wrap gap-3 p-3">
        <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All org units</option>
          {orgUnits?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="dgs-card inline-block p-4">
          <div className="grid" style={{ gridTemplateColumns: '80px repeat(5, 90px)' }}>
            <div />
            {[1, 2, 3, 4, 5].map((impact) => (
              <div key={impact} className="pb-1 text-center text-xs font-semibold text-[var(--dgs-text-muted)]">
                Impact {impact}
              </div>
            ))}
            {[5, 4, 3, 2, 1].map((likelihood) => (
              <RowFragment key={likelihood} likelihood={likelihood} cellFor={cellFor} onClick={goToFiltered} />
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--dgs-text-muted)]">
            Cells show the count of open risks at each likelihood × impact combination. Click a cell to view matching
            risks in the register.
          </p>
        </div>
      )}
    </div>
  );
}

function RowFragment({
  likelihood,
  cellFor,
  onClick,
}: {
  likelihood: number;
  cellFor: (likelihood: number, impact: number) => HeatMapCell | undefined;
  onClick: (likelihood: number, impact: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs font-semibold text-[var(--dgs-text-muted)]">
        Likelihood {likelihood}
      </div>
      {[1, 2, 3, 4, 5].map((impact) => {
        const cell = cellFor(likelihood, impact);
        const bandClass = cell?.band ? BAND_BG_CLASS[cell.band] : 'bg-gray-100';
        return (
          <button
            key={impact}
            onClick={() => onClick(likelihood, impact)}
            className={`m-0.5 flex h-16 w-20 items-center justify-center rounded text-lg font-bold text-white ${bandClass}`}
            style={!cell?.band ? { color: '#9ca3af' } : undefined}
          >
            {cell?.count ?? 0}
          </button>
        );
      })}
    </>
  );
}
