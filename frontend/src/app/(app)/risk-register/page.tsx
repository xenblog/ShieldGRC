'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { BandBadge } from '@/components/BandBadge';
import { OrgUnit, Category, HeatMapCell, Risk, RiskGroup, RiskStatus, ScoreBand, UserSummary } from '@/lib/types';
import { BAND_BG_CLASS } from '@/lib/score-band';
import { useAuth } from '@/lib/auth-context';

const STATUSES: RiskStatus[] = ['IDENTIFIED', 'ASSESSED', 'MITIGATING', 'ACCEPTED', 'CLOSED'];
const BANDS: ScoreBand[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function RiskRegisterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <RiskRegisterPageInner />
    </Suspense>
  );
}

function RiskRegisterPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [grouped, setGrouped] = useState(true);
  // Seeded from the URL once on mount - the filter selects below then take
  // over from user interaction.
  const [orgUnitId, setOrgUnitId] = useState(searchParams.get('orgUnitId') ?? '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [band, setBand] = useState(searchParams.get('band') ?? '');
  const [ownerId, setOwnerId] = useState(searchParams.get('ownerId') ?? '');
  // Set by clicking a Heat Map cell - an exact likelihood x impact drill-in on
  // top of the filters above. Cleared independently of the other filters.
  const [cell, setCell] = useState<{ likelihood: number; impact: number } | null>(null);

  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (orgUnitId) params.set('orgUnitId', orgUnitId);
    if (categoryId) params.set('categoryId', categoryId);
    if (status) params.set('status', status);
    if (band) params.set('band', band);
    if (ownerId) params.set('ownerId', ownerId);
    if (cell) {
      params.set('likelihood', String(cell.likelihood));
      params.set('impact', String(cell.impact));
    }
    return params.toString();
  }, [orgUnitId, categoryId, status, band, ownerId, cell]);

  // The Heat Map only supports org unit/category scoping (it plots every
  // likelihood x impact cell regardless of band, so status/band/owner/exact
  // cell filters don't apply to it) - both sections still read from the same
  // org unit/category selection above.
  const heatMapQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (orgUnitId) params.set('orgUnitId', orgUnitId);
    if (categoryId) params.set('categoryId', categoryId);
    return params.toString();
  }, [orgUnitId, categoryId]);

  const flatPath = `/risks${query ? `?${query}` : ''}`;
  const groupedPath = `/risks/grouped${query ? `?${query}` : ''}`;
  const heatMapPath = `/risks/heat-map${heatMapQuery ? `?${heatMapQuery}` : ''}`;

  const { data: flatRisks, loading: flatLoading } = useApiGet<Risk[]>(!grouped ? flatPath : null, [flatPath, grouped]);
  const { data: groups, loading: groupedLoading } = useApiGet<RiskGroup[]>(grouped ? groupedPath : null, [
    groupedPath,
    grouped,
  ]);
  const { data: heatMapCells, loading: heatMapLoading } = useApiGet<HeatMapCell[]>(heatMapPath, [heatMapPath]);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  function selectCell(likelihood: number, impact: number) {
    // Toggle off if the same cell is clicked again.
    setCell((prev) => (prev && prev.likelihood === likelihood && prev.impact === impact ? null : { likelihood, impact }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Risk Register</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
            Group by category
          </label>
          {canCreate && (
            <Link
              href="/risk-register/new"
              className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
            >
              New Risk
            </Link>
          )}
        </div>
      </div>

      <div className="dgs-card flex flex-wrap items-center gap-3 p-3">
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
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={band} onChange={(e) => setBand(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All bands</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All owners</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {cell && (
          <span className="flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
            Likelihood {cell.likelihood} × Impact {cell.impact}
            <button onClick={() => setCell(null)} className="text-gray-500 hover:text-gray-900">
              ✕
            </button>
          </span>
        )}
      </div>

      {!grouped && (
        <div className="dgs-card overflow-x-auto">
          {flatLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : (
            <RiskTable risks={flatRisks ?? []} />
          )}
        </div>
      )}

      {grouped && (
        <div className="space-y-3">
          {groupedLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {groups?.map((group) => (
            <RiskGroupSection key={group.category.id} group={group} />
          ))}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Risk Heat Map</h2>
        <div className="dgs-card inline-block p-4">
          {heatMapLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <div className="grid" style={{ gridTemplateColumns: '80px repeat(5, 90px)' }}>
                <div />
                {[1, 2, 3, 4, 5].map((impact) => (
                  <div key={impact} className="pb-1 text-center text-xs font-semibold text-[var(--dgs-text-muted)]">
                    Impact {impact}
                  </div>
                ))}
                {[5, 4, 3, 2, 1].map((likelihood) => (
                  <HeatMapRow
                    key={likelihood}
                    likelihood={likelihood}
                    cells={heatMapCells}
                    selected={cell}
                    onClick={selectCell}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--dgs-text-muted)]">
                Cells show the count of open risks at each likelihood × impact combination (scoped to the org
                unit/category filters above). Click a cell to filter the register above to that exact combination;
                click again to clear it.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HeatMapRow({
  likelihood,
  cells,
  selected,
  onClick,
}: {
  likelihood: number;
  cells: HeatMapCell[] | null | undefined;
  selected: { likelihood: number; impact: number } | null;
  onClick: (likelihood: number, impact: number) => void;
}) {
  function cellFor(impact: number) {
    return cells?.find((c) => c.likelihood === likelihood && c.impact === impact);
  }

  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs font-semibold text-[var(--dgs-text-muted)]">
        Likelihood {likelihood}
      </div>
      {[1, 2, 3, 4, 5].map((impact) => {
        const c = cellFor(impact);
        const bandClass = c?.band ? BAND_BG_CLASS[c.band] : 'bg-gray-100';
        const isSelected = selected?.likelihood === likelihood && selected?.impact === impact;
        return (
          <button
            key={impact}
            onClick={() => onClick(likelihood, impact)}
            className={`m-0.5 flex h-16 w-20 items-center justify-center rounded text-lg font-bold text-white ${bandClass} ${
              isSelected ? 'ring-4 ring-offset-1' : ''
            }`}
            style={{
              color: c?.band ? undefined : '#9ca3af',
              ...(isSelected ? ({ '--tw-ring-color': 'var(--dgs-primary)' } as React.CSSProperties) : {}),
            }}
          >
            {c?.count ?? 0}
          </button>
        );
      })}
    </>
  );
}

function RiskGroupSection({ group }: { group: RiskGroup }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="dgs-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="font-medium">
          {open ? '▾' : '▸'} {group.category.name}
        </span>
        <span className="text-xs text-[var(--dgs-text-muted)]">
          {group.count} risk{group.count === 1 ? '' : 's'} · avg residual score{' '}
          {group.avgResidualScore != null ? group.avgResidualScore.toFixed(1) : '—'}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t" style={{ borderColor: 'var(--dgs-border)' }}>
          <RiskTable risks={group.risks} />
        </div>
      )}
    </div>
  );
}

type SortKey = 'title' | 'orgUnit' | 'owner' | 'status' | 'inherent' | 'residual' | 'nextReviewDate';

const SORT_ACCESSORS: Record<SortKey, (r: Risk) => string | number> = {
  title: (r) => r.title.toLowerCase(),
  orgUnit: (r) => r.orgUnit?.name ?? '',
  owner: (r) => r.owner?.name ?? '',
  status: (r) => r.status,
  inherent: (r) => r.inherentScore,
  residual: (r) => r.residualScore ?? -1,
  nextReviewDate: (r) => (r.nextReviewDate ? new Date(r.nextReviewDate).getTime() : Number.POSITIVE_INFINITY),
};

const SORT_HEADERS: { key: SortKey; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'orgUnit', label: 'Org Unit' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
  { key: 'inherent', label: 'Inherent' },
  { key: 'residual', label: 'Residual' },
  { key: 'nextReviewDate', label: 'Next review' },
];

function RiskTable({ risks }: { risks: Risk[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  if (risks.length === 0) {
    return <p className="p-4 text-sm text-gray-400">No risks match the current filters.</p>;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const sortedRisks = sortKey
    ? [...risks].sort((a, b) => {
        const accessor = SORT_ACCESSORS[sortKey];
        const av = accessor(a);
        const bv = accessor(b);
        if (av < bv) return -1 * sortDir;
        if (av > bv) return 1 * sortDir;
        return 0;
      })
    : risks;

  return (
    <table className="dgs-table w-full">
      <thead>
        <tr>
          {SORT_HEADERS.map((h) => (
            <th key={h.key}>
              <button
                onClick={() => toggleSort(h.key)}
                className="flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800"
              >
                {h.label}
                {sortKey === h.key && <span>{sortDir === 1 ? '▲' : '▼'}</span>}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRisks.map((r) => (
          <tr key={r.id}>
            <td>
              <Link href={`/risk-register/${r.id}`} className="hover:underline">
                {r.title}
              </Link>
              {r.isOverdue && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Review overdue</span>}
            </td>
            <td>{r.orgUnit?.name}</td>
            <td>{r.owner?.name}</td>
            <td>{r.status}</td>
            <td>
              <BandBadge band={r.inherentBand} /> <span className="text-xs text-gray-400">({r.inherentScore})</span>
            </td>
            <td>
              {r.residualBand ? (
                <>
                  <BandBadge band={r.residualBand} /> <span className="text-xs text-gray-400">({r.residualScore})</span>
                </>
              ) : (
                '—'
              )}
            </td>
            <td>{r.nextReviewDate ? new Date(r.nextReviewDate).toLocaleDateString() : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
