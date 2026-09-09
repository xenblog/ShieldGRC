'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { BandBadge } from '@/components/BandBadge';
import { OrgUnit, Category, PaginatedRisks, Risk, RiskStatus, ScoreBand, UserSummary } from '@/lib/types';
import { BAND_DOT_COLOR, matrixCellBackground } from '@/lib/score-band';
import { RISK_STATUS_CLASS, RISK_STATUS_LABEL } from '@/lib/status-labels';
import { useAuth } from '@/lib/auth-context';

const STATUSES: RiskStatus[] = ['IDENTIFIED', 'ASSESSED', 'MITIGATING', 'ACCEPTED', 'CLOSED'];
const BANDS: ScoreBand[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default function RiskRegisterPage() {
  return (
    <Suspense fallback={<p className="helper-note">Loading…</p>}>
      <RiskRegisterPageInner />
    </Suspense>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function RiskRegisterPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [orgUnitId, setOrgUnitId] = useState(searchParams.get('orgUnitId') ?? '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [band, setBand] = useState(searchParams.get('band') ?? '');
  const [ownerId, setOwnerId] = useState(searchParams.get('ownerId') ?? '');
  // Set by clicking a matrix cell - an exact likelihood x impact drill-in on
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
    // Server-side scoping only (org unit ACLs, category/status/band/owner) -
    // fetch every matching row unpaginated so search/sort/pagination below
    // can work correctly across the whole result set, not just one page.
    params.set('pageSize', '0');
    return params.toString();
  }, [orgUnitId, categoryId, status, band, ownerId, cell]);

  // The matrix only supports org unit/category scoping (it plots every
  // likelihood x impact cell regardless of band).
  const matrixQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (orgUnitId) params.set('orgUnitId', orgUnitId);
    if (categoryId) params.set('categoryId', categoryId);
    return params.toString();
  }, [orgUnitId, categoryId]);

  const risksPath = `/risks${query ? `?${query}` : ''}`;
  const matrixPath = `/risks/heat-map${matrixQuery ? `?${matrixQuery}` : ''}`;

  const { data: risksPage, loading: risksLoading } = useApiGet<PaginatedRisks>(risksPath, [risksPath]);
  const { data: matrixCells, loading: matrixLoading } = useApiGet<{ likelihood: number; impact: number; count: number; band: ScoreBand }[]>(
    matrixPath,
    [matrixPath],
  );

  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const searchLower = search.trim().toLowerCase();
  const filteredRisks = (risksPage?.items ?? []).filter(
    (r) => !searchLower || r.title.toLowerCase().includes(searchLower) || r.code.toLowerCase().includes(searchLower),
  );

  function selectCell(likelihood: number, impact: number) {
    setCell((prev) => (prev && prev.likelihood === likelihood && prev.impact === impact ? null : { likelihood, impact }));
  }

  function cellFor(likelihood: number, impact: number) {
    return matrixCells?.find((c) => c.likelihood === likelihood && c.impact === impact);
  }

  function chipsFor(likelihood: number, impact: number): Risk[] {
    return filteredRisks.filter((r) => r.likelihood === likelihood && r.impact === impact);
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Risk Register</div>
        <div className="topbar-right">
          {canCreate && (
            <Link href="/risk-register/new" className="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Risk
            </Link>
          )}
        </div>
      </div>

      <div className="content">
        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="filter-bar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="19" y1="19" x2="15.3" y2="15.3" />
              </svg>
              <input placeholder="Search for a risk…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="select">
              <option value="">Org unit: All</option>
              {orgUnits?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="select">
              <option value="">Category: All</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="select">
              <option value="">Status: All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RISK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select value={band} onChange={(e) => setBand(e.target.value)} className="select">
              <option value="">Score: All</option>
              {BANDS.map((b) => (
                <option key={b} value={b}>
                  {b[0] + b.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="select">
              <option value="">Owner: All</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          {cell && (
            <div style={{ marginTop: 10 }}>
              <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Likelihood {cell.likelihood} × Impact {cell.impact}
                <button onClick={() => setCell(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--dgs-umami)' }}>
                  ✕
                </button>
              </span>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {risksLoading ? (
            <p className="helper-note" style={{ padding: 18 }}>
              Loading…
            </p>
          ) : (
            <RiskTable risks={filteredRisks} />
          )}
        </div>

        <div className="card">
          <div className="section-title">Risk Matrix (Likelihood × Impact)</div>
          {matrixLoading ? (
            <p className="helper-note">Loading…</p>
          ) : (
            <>
              <div className="matrix-grid">
                <div />
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="matrix-header">
                    I{i}
                  </div>
                ))}
                {[5, 4, 3, 2, 1].map((likelihood) => (
                  <MatrixRow
                    key={likelihood}
                    likelihood={likelihood}
                    cellFor={cellFor}
                    chipsFor={chipsFor}
                    selected={cell}
                    onClick={selectCell}
                  />
                ))}
              </div>
              <div className="legend" style={{ marginTop: 12 }}>
                <span>L = Likelihood, I = Impact (1 = Very Low … 5 = Very High) — each chip is a risk ID from the register above. Click a cell to filter.</span>
              </div>
              <div className="legend" style={{ marginTop: 6 }}>
                {BANDS.map((b) => (
                  <span key={b}>
                    <span className="legend-dot" style={{ background: BAND_DOT_COLOR[b] }} />
                    {b[0] + b.slice(1).toLowerCase()}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function MatrixRow({
  likelihood,
  cellFor,
  chipsFor,
  selected,
  onClick,
}: {
  likelihood: number;
  cellFor: (l: number, i: number) => { band: ScoreBand } | undefined;
  chipsFor: (l: number, i: number) => Risk[];
  selected: { likelihood: number; impact: number } | null;
  onClick: (l: number, i: number) => void;
}) {
  return (
    <>
      <div className="matrix-row-label">L{likelihood}</div>
      {[1, 2, 3, 4, 5].map((impact) => {
        const cellData = cellFor(likelihood, impact);
        const chips = chipsFor(likelihood, impact);
        const isSelected = selected?.likelihood === likelihood && selected?.impact === impact;
        return (
          <div
            key={impact}
            className={`matrix-cell${isSelected ? ' selected' : ''}`}
            style={{ background: cellData ? matrixCellBackground(cellData.band) : undefined }}
            onClick={() => onClick(likelihood, impact)}
          >
            {chips.map((r) => (
              <span key={r.id} className={`matrix-chip matrix-chip-${r.inherentBand.toLowerCase()}`}>
                {r.code}
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
}

type SortKey = 'id' | 'title' | 'category' | 'likelihood' | 'impact' | 'inherent' | 'residual' | 'status' | 'owner';

const SORT_ACCESSORS: Record<SortKey, (r: Risk) => string | number> = {
  id: (r) => r.code,
  title: (r) => r.title.toLowerCase(),
  category: (r) => r.category?.name.toLowerCase() ?? '',
  likelihood: (r) => r.likelihood,
  impact: (r) => r.impact,
  inherent: (r) => r.inherentScore,
  residual: (r) => r.residualScore ?? -1,
  status: (r) => r.status,
  owner: (r) => r.owner?.name.toLowerCase() ?? '',
};

/**
 * The main Risk Register list is a single flat, sortable table - risks are
 * never grouped by category or any other dimension. Sorted, searched, and
 * paginated entirely client-side over the full (already org/category/
 * status/band/owner-filtered) result set the parent fetched, so search
 * always matches across every page rather than just the visible one.
 */
function RiskTable({ risks }: { risks: Risk[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('inherent');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    setPage(1);
  }, [risks, pageSize]);

  if (risks.length === 0) {
    return (
      <p className="helper-note" style={{ padding: 18 }}>
        No risks match the current filters.
      </p>
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const accessor = SORT_ACCESSORS[sortKey];
  const sortedRisks = [...risks].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(sortedRisks.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRisks = pageSize === 0 ? sortedRisks : sortedRisks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstShown = sortedRisks.length === 0 ? 0 : (currentPage - 1) * (pageSize === 0 ? sortedRisks.length : pageSize) + 1;
  const lastShown = pageSize === 0 ? sortedRisks.length : Math.min(currentPage * pageSize, sortedRisks.length);

  function sortableHeader(key: SortKey, label: string, align?: 'center') {
    return (
      <th onClick={() => toggleSort(key)} style={{ cursor: 'pointer', textAlign: align }}>
        {label}
        {sortKey === key && <span> {sortDir === 1 ? '▲' : '▼'}</span>}
      </th>
    );
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="grc-table">
          <thead>
            <tr>
              {sortableHeader('id', 'ID')}
              {sortableHeader('title', 'Risk Description')}
              {sortableHeader('category', 'Category')}
              {sortableHeader('likelihood', 'Likelihood', 'center')}
              {sortableHeader('impact', 'Impact', 'center')}
              {sortableHeader('inherent', 'Inherent Score')}
              {sortableHeader('residual', 'Residual Score')}
              {sortableHeader('status', 'Status')}
              {sortableHeader('owner', 'Owner')}
            </tr>
          </thead>
          <tbody>
            {pageRisks.map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'var(--font-chrome)', color: 'var(--dgs-umami)' }}>{r.code}</td>
                <td>
                  <Link href={`/risk-register/${r.id}`} className="risk-title">
                    {r.title}
                  </Link>
                  {r.isOverdue && (
                    <span className="overdue" style={{ display: 'inline-flex', marginLeft: 6 }}>
                      Review overdue
                    </span>
                  )}
                </td>
                <td>
                  <span className="tag">{r.category?.name}</span>
                </td>
                <td style={{ textAlign: 'center' }}>{r.likelihood}</td>
                <td style={{ textAlign: 'center' }}>{r.impact}</td>
                <td>
                  <BandBadge band={r.inherentBand} score={r.inherentScore} showLabel />
                </td>
                <td>{r.residualBand && r.residualScore != null ? <BandBadge band={r.residualBand} score={r.residualScore} showLabel /> : '—'}</td>
                <td>
                  <span className={`status ${RISK_STATUS_CLASS[r.status]}`}>{RISK_STATUS_LABEL[r.status]}</span>
                </td>
                <td>
                  <div className="owner-cell">
                    <div className="owner-avatar">{initials(r.owner?.name ?? '?')}</div>
                    {r.owner?.name}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          Showing {firstShown}–{lastShown} of {sortedRisks.length} risk{sortedRisks.length === 1 ? '' : 's'} · sorted by{' '}
          {SORT_LABEL[sortKey]} ({sortDir === 1 ? 'ascending' : 'descending'})
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div className="score-legend">
            <span>Score:</span>
            {BANDS.map((b) => (
              <span key={b}>
                <span className="score-legend-dot" style={{ background: BAND_DOT_COLOR[b] }} />
                {b[0] + b.slice(1).toLowerCase()} {b === 'LOW' ? '<4' : b === 'MEDIUM' ? '4–7' : b === 'HIGH' ? '8–14' : '≥15'}
              </span>
            ))}
          </div>
          <div className="pagination">
            <span>Rows per page:</span>
            <select
              className="page-size-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ font: 'inherit' }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>All</option>
            </select>
            <div className="page-nav">
              <button type="button" className="page-btn" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                ‹
              </button>
              <span>
                Page {currentPage} of {pageCount}
              </span>
              <button type="button" className="page-btn" disabled={currentPage >= pageCount} onClick={() => setPage((p) => p + 1)}>
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const SORT_LABEL: Record<SortKey, string> = {
  id: 'ID',
  title: 'Risk Description',
  category: 'Category',
  likelihood: 'Likelihood',
  impact: 'Impact',
  inherent: 'Inherent Score',
  residual: 'Residual Score',
  status: 'Status',
  owner: 'Owner',
};
