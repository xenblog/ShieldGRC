'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiGet } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { BusinessProcess, BusinessProcessCriticalityTier, OrgUnit, PaginatedBusinessProcesses } from '@/lib/types';
import { CRITICALITY_TIER_BADGE_CLASS, CRITICALITY_TIER_LABEL } from '@/lib/status-labels';

const TIERS: BusinessProcessCriticalityTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export default function BiaRegisterPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const [search, setSearch] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [criticalityTier, setCriticalityTier] = useState('');

  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');

  const query = new URLSearchParams();
  if (orgUnitId) query.set('orgUnitId', orgUnitId);
  if (criticalityTier) query.set('criticalityTier', criticalityTier);
  query.set('pageSize', '0');
  const path = `/business-processes?${query.toString()}`;
  const { data: page, loading } = useApiGet<PaginatedBusinessProcesses>(path, [path]);

  const searchLower = search.trim().toLowerCase();
  const filtered = (page?.items ?? []).filter(
    (p) => !searchLower || p.name.toLowerCase().includes(searchLower) || p.code.toLowerCase().includes(searchLower),
  );

  const counts = TIERS.reduce<Record<string, number>>((acc, tier) => {
    acc[tier] = (page?.items ?? []).filter((p) => p.criticalityTier === tier).length;
    return acc;
  }, {});

  return (
    <>
      <div className="topbar">
        <div className="page-title">BIA Register</div>
        <div className="topbar-right">
          {canCreate && (
            <Link href="/bia-register/new" className="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Business Process
            </Link>
          )}
        </div>
      </div>

      <div className="content">
        <div className="snapshot-row">
          {TIERS.map((tier) => (
            <div key={tier} className="snapshot-tile" style={{ background: 'var(--dgs-salt-tint)' }}>
              <div className="snapshot-num">{counts[tier] ?? 0}</div>
              <div className="snapshot-label">{CRITICALITY_TIER_LABEL[tier]}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="filter-bar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="19" y1="19" x2="15.3" y2="15.3" />
              </svg>
              <input placeholder="Search for a business process…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="select">
              <option value="">Org unit: All</option>
              {orgUnits?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select value={criticalityTier} onChange={(e) => setCriticalityTier(e.target.value)} className="select">
              <option value="">Criticality: All</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {CRITICALITY_TIER_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <p className="helper-note" style={{ padding: 18 }}>
              Loading…
            </p>
          ) : (
            <BusinessProcessTable processes={filtered} />
          )}
        </div>
      </div>
    </>
  );
}

function BusinessProcessTable({ processes }: { processes: BusinessProcess[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    setPage(1);
  }, [processes, pageSize]);

  if (processes.length === 0) {
    return (
      <p className="helper-note" style={{ padding: 18 }}>
        No business processes match the current filters.
      </p>
    );
  }

  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(processes.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = pageSize === 0 ? processes : processes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstShown = processes.length === 0 ? 0 : (currentPage - 1) * (pageSize === 0 ? processes.length : pageSize) + 1;
  const lastShown = pageSize === 0 ? processes.length : Math.min(currentPage * pageSize, processes.length);

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="grc-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Process</th>
              <th>Org Unit</th>
              <th>Owner</th>
              <th>Criticality</th>
              <th>RTO</th>
              <th>RPO</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'var(--font-chrome)', color: 'var(--dgs-umami)' }}>{p.code}</td>
                <td>
                  <Link href={`/bia-register/${p.id}`} className="risk-title">
                    {p.name}
                  </Link>
                </td>
                <td>
                  <span className="tag">{p.orgUnit.name}</span>
                </td>
                <td>
                  <div className="owner-cell">{p.owner.name}</div>
                </td>
                <td>
                  <span className={`badge ${CRITICALITY_TIER_BADGE_CLASS[p.criticalityTier]}`}>{CRITICALITY_TIER_LABEL[p.criticalityTier]}</span>
                </td>
                <td>{formatMinutes(p.rtoMinutes)}</td>
                <td>{formatMinutes(p.rpoMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          Showing {firstShown}–{lastShown} of {processes.length} process{processes.length === 1 ? '' : 'es'}
        </span>
        <div className="pagination">
          <span>Rows per page:</span>
          <select className="page-size-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ font: 'inherit' }}>
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
    </>
  );
}
