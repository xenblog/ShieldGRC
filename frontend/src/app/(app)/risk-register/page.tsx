'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { BandBadge } from '@/components/BandBadge';
import { OrgUnit, Category, Risk, RiskGroup, RiskStatus, ScoreBand, UserSummary } from '@/lib/types';
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
  // Seeded from the URL once on mount (e.g. drilling in from the Risk Heat
  // Map's ?orgUnitId=&categoryId=&band= link) - the filter selects below
  // then take over from user interaction.
  const [orgUnitId, setOrgUnitId] = useState(searchParams.get('orgUnitId') ?? '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [band, setBand] = useState(searchParams.get('band') ?? '');
  const [ownerId, setOwnerId] = useState(searchParams.get('ownerId') ?? '');

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
    return params.toString();
  }, [orgUnitId, categoryId, status, band, ownerId]);

  const flatPath = `/risks${query ? `?${query}` : ''}`;
  const groupedPath = `/risks/grouped${query ? `?${query}` : ''}`;

  const { data: flatRisks, loading: flatLoading } = useApiGet<Risk[]>(!grouped ? flatPath : null, [flatPath, grouped]);
  const { data: groups, loading: groupedLoading } = useApiGet<RiskGroup[]>(grouped ? groupedPath : null, [
    groupedPath,
    grouped,
  ]);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  return (
    <div className="space-y-4">
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
    </div>
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

function RiskTable({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) {
    return <p className="p-4 text-sm text-gray-400">No risks match the current filters.</p>;
  }
  return (
    <table className="dgs-table w-full">
      <thead>
        <tr>
          <th>Title</th>
          <th>Org Unit</th>
          <th>Owner</th>
          <th>Status</th>
          <th>Inherent</th>
          <th>Residual</th>
          <th>Next review</th>
        </tr>
      </thead>
      <tbody>
        {risks.map((r) => (
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
