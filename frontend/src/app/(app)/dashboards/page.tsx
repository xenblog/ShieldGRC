'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useApiGet } from '@/lib/hooks';
import { OrgUnit, ScoreBand } from '@/lib/types';
import { heatCellStyle } from '@/lib/score-band';
import { BandBadge } from '@/components/BandBadge';

interface TrendPoint {
  month: string;
  newRisksCount: number;
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

interface ExecutiveTiles {
  openRisksByBand: Record<ScoreBand, number>;
  riskTrend: TrendPoint[];
  heatMapByOrgUnit: { orgUnitId: string; orgUnitName: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }[];
  topOpenRisks: { id: string; title: string; score: number; orgUnit: { name: string } }[];
  assessmentProgressStatus: { onTrack: number; overdue: number; total: number };
  overdueRiskReviewsCount: number;
  avgResidualScore: number | null;
}

interface OperationalTiles extends ExecutiveTiles {
  overdueRiskReviews: {
    id: string;
    title: string;
    nextReviewDate: string;
    daysOverdue: number;
    orgUnit: { id: string; name: string };
    owner: { id: string; name: string };
  }[];
  myAssignedRisks: { count: number; needsReview: number };
  openRisksByOwner: { ownerId: string; ownerName: string; count: number }[];
  recentRisks: { id: string; title: string; inherentBand: ScoreBand; score: number; orgUnit: { name: string } }[];
}

const TREND_LINE_COLOR: Record<ScoreBand, string> = {
  LOW: '#50634D',
  MEDIUM: '#FED37A',
  HIGH: '#6B5849',
  CRITICAL: '#AD1922',
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 640;
  const height = 232;
  const left = 30;
  const right = 620;
  const baseline = 200;
  const top = 40;
  const maxVal = Math.max(1, ...points.flatMap((p) => [p.LOW, p.MEDIUM, p.HIGH, p.CRITICAL]));

  const xFor = (i: number) => left + (i * (right - left)) / Math.max(1, points.length - 1);
  const yFor = (v: number) => baseline - (v / maxVal) * (baseline - top);

  const bands: ScoreBand[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const polylines = bands.map((band) => points.map((p, i) => `${xFor(i)},${yFor(p[band])}`).join(' '));

  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="220" style={{ overflow: 'visible' }}>
        {[200, 164, 128, 92, 56].map((y) => (
          <line key={y} x1={left} y1={y} x2={right} y2={y} stroke={y === 200 ? '#DFDFDF' : '#F1E5D5'} strokeWidth={1} />
        ))}
        {bands.map((band, i) => (
          <polyline key={band} points={polylines[i]} fill="none" stroke={TREND_LINE_COLOR[band]} strokeWidth={2.5} />
        ))}
        {points.map((p, i) => (
          <text key={p.month} x={xFor(i) - 10} y={216} fontFamily="Arial" fontSize="11" fill="#6B5849">
            {new Date(`${p.month}-01`).toLocaleDateString('en', { month: 'short' })}
          </text>
        ))}
      </svg>
      <div className="legend">
        {bands.map((band) => (
          <span key={band}>
            <span className="legend-dot" style={{ background: TREND_LINE_COLOR[band] }} />
            {band[0] + band.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
    </>
  );
}

function OrgUnitHeatGrid({ rows }: { rows: ExecutiveTiles['heatMapByOrgUnit'] }) {
  const bands: ScoreBand[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const maxCount = Math.max(1, ...rows.flatMap((r) => bands.map((b) => r[b])));
  return (
    <div className="heat-grid">
      <div />
      {bands.map((b) => (
        <div key={b} className="heat-head">
          {b[0] + b.slice(1).toLowerCase()}
        </div>
      ))}
      {rows.map((row) => (
        <Fragment key={row.orgUnitId}>
          <div className="heat-row-label">{row.orgUnitName}</div>
          {bands.map((band) => {
            const style = heatCellStyle(band, row[band], maxCount);
            return (
              <div key={`${row.orgUnitId}-${band}`} className="heat-cell" style={style}>
                {row[band]}
              </div>
            );
          })}
        </Fragment>
      ))}
      {rows.length === 0 && <p className="helper-note">No open risks yet.</p>}
    </div>
  );
}

function TopbarRight({
  orgUnits,
  orgUnitId,
  setOrgUnitId,
  view,
  setView,
  canToggle,
  lastUpdated,
}: {
  orgUnits: OrgUnit[] | null;
  orgUnitId: string;
  setOrgUnitId: (v: string) => void;
  view: 'executive' | 'operational';
  setView: (v: 'executive' | 'operational') => void;
  canToggle: boolean;
  lastUpdated: Date | null;
}) {
  return (
    <div className="topbar-right">
      {lastUpdated && <span className="updated">Last updated {formatTime(lastUpdated)}</span>}
      <div className="view-toggle">
        <button
          type="button"
          className={`view-toggle-item${view === 'executive' ? ' active' : ''}`}
          onClick={() => canToggle && setView('executive')}
        >
          Executive
        </button>
        <button
          type="button"
          className={`view-toggle-item${view === 'operational' ? ' active' : ''}`}
          onClick={() => canToggle && setView('operational')}
        >
          Operational
        </button>
      </div>
      <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="select">
        <option value="">All org units</option>
        {orgUnits?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function DashboardsPage() {
  const { user } = useAuth();
  const canOperational = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER' || user?.role === 'AUDITOR';
  const canExecutive = user?.role === 'ADMIN' || user?.role === 'EXECUTIVE';
  const canToggle = user?.role === 'ADMIN';

  const [view, setView] = useState<'executive' | 'operational'>(canOperational ? 'operational' : 'executive');
  const [orgUnitId, setOrgUnitId] = useState('');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');

  const endpoint = view === 'operational' ? '/dashboards/operational' : '/dashboards/executive';
  const query = orgUnitId ? `?orgUnitId=${orgUnitId}` : '';
  const path = `${endpoint}${query}`;
  const { data, loading, error } = useApiGet<OperationalTiles | ExecutiveTiles>(path, [path]);

  const lastUpdated = useMemo(() => (data ? new Date() : null), [data]);

  if (!canExecutive && !canOperational) {
    return <p className="helper-note">Your role does not have access to any dashboard view.</p>;
  }

  const operational = view === 'operational' ? (data as OperationalTiles | null) : null;

  return (
    <>
      <div className="topbar">
        <div className="page-title">Dashboard</div>
        <TopbarRight
          orgUnits={orgUnits}
          orgUnitId={orgUnitId}
          setOrgUnitId={setOrgUnitId}
          view={view}
          setView={setView}
          canToggle={canToggle}
          lastUpdated={lastUpdated}
        />
      </div>

      <div className="content">
        {loading && <p className="helper-note">Loading dashboard…</p>}
        {error && <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>{error}</p>}

        {data && (
          <>
            {view === 'executive' && (
              <div className="kpi-row">
                <div className="card">
                  <div className="kpi-label">Open risks</div>
                  <div className="kpi-value">
                    {data.openRisksByBand.LOW + data.openRisksByBand.MEDIUM + data.openRisksByBand.HIGH + data.openRisksByBand.CRITICAL}
                  </div>
                </div>
                <div className="card">
                  <div className="kpi-label">Critical risks</div>
                  <div className="kpi-value">{data.openRisksByBand.CRITICAL}</div>
                </div>
                <div className="card">
                  <div className="kpi-label">Overdue reviews</div>
                  <div className="kpi-value">{data.overdueRiskReviewsCount}</div>
                  {data.overdueRiskReviewsCount > 0 && <div className="kpi-sub">Requires action</div>}
                </div>
                <div className="card">
                  <div className="kpi-label">Avg. residual score</div>
                  <div className="kpi-value">{data.avgResidualScore ?? '—'}</div>
                  <div className="kpi-sub">
                    Assessments: {data.assessmentProgressStatus.onTrack} on track, {data.assessmentProgressStatus.overdue} overdue
                  </div>
                </div>
              </div>
            )}

            {operational && (
              <div className="kpi-row">
                <div className="card">
                  <div className="kpi-label">Open risks</div>
                  <div className="kpi-value">
                    {data.openRisksByBand.LOW + data.openRisksByBand.MEDIUM + data.openRisksByBand.HIGH + data.openRisksByBand.CRITICAL}
                  </div>
                </div>
                <div className="card">
                  <div className="kpi-label">Overdue reviews</div>
                  <div className="kpi-value">{data.overdueRiskReviewsCount}</div>
                  {data.overdueRiskReviewsCount > 0 && <div className="kpi-sub">Requires action</div>}
                </div>
                <div className="card">
                  <div className="kpi-label">My assigned risks</div>
                  <div className="kpi-value">{operational.myAssignedRisks.count}</div>
                  {operational.myAssignedRisks.needsReview > 0 && (
                    <div className="kpi-sub">{operational.myAssignedRisks.needsReview} awaiting review</div>
                  )}
                </div>
                <div className="card">
                  <div className="kpi-label">Critical risks</div>
                  <div className="kpi-value">{data.openRisksByBand.CRITICAL}</div>
                </div>
              </div>
            )}

            {operational && (
              <div className="card">
                <div className="section-title">Overdue reviews</div>
                {operational.overdueRiskReviews.length === 0 ? (
                  <p className="helper-note">None.</p>
                ) : (
                  <table className="grc-table">
                    <thead>
                      <tr>
                        <th style={{ width: '42%' }}>Risk</th>
                        <th>Owner</th>
                        <th>Org unit</th>
                        <th>Days overdue</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {operational.overdueRiskReviews.map((r) => (
                        <tr key={r.id}>
                          <td className="risk-title">{r.title}</td>
                          <td>{r.owner.name}</td>
                          <td>
                            <span className="tag">{r.orgUnit.name}</span>
                          </td>
                          <td className="overdue">{r.daysOverdue} days</td>
                          <td>
                            <Link href={`/risk-register/${r.id}`} className="link-action">
                              View details →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="two-col" style={view === 'executive' ? { gridTemplateColumns: '1.4fr 1fr' } : { gridTemplateColumns: '1fr 1.2fr' }}>
              {view === 'executive' && (
                <>
                  <div className="card">
                    <div className="section-title">Risk trend — last 6 months</div>
                    <TrendChart points={data.riskTrend} />
                  </div>
                  <div className="card">
                    <div className="section-title">Risk landscape by org unit</div>
                    <OrgUnitHeatGrid rows={data.heatMapByOrgUnit} />
                  </div>
                </>
              )}

              {operational && (
                <>
                  <div className="card">
                    <div className="section-title">Open risks by owner</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
                      {operational.openRisksByOwner.map((row) => {
                        const max = Math.max(1, ...operational.openRisksByOwner.map((r) => r.count));
                        return (
                          <div key={row.ownerId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 105, fontFamily: 'var(--font-chrome)', fontSize: 12 }}>{row.ownerName}</div>
                            <div style={{ flexGrow: 1, background: 'var(--dgs-salt-tint)', borderRadius: 5, height: 14 }}>
                              <div
                                style={{
                                  width: `${(row.count / max) * 100}%`,
                                  background: 'var(--dgs-groent)',
                                  height: 14,
                                  borderRadius: 5,
                                }}
                              />
                            </div>
                            <div style={{ width: 20, fontFamily: 'var(--font-chrome)', fontSize: 12, textAlign: 'right' }}>{row.count}</div>
                          </div>
                        );
                      })}
                      {operational.openRisksByOwner.length === 0 && <p className="helper-note">No open risks yet.</p>}
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-title">
                      Recent risks
                      <Link href="/risk-register" className="section-title-link">
                        See all risks →
                      </Link>
                    </div>
                    <div className="rowlist">
                      {operational.recentRisks.map((r) => (
                        <div key={r.id} className="rowlist-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <BandBadge band={r.inherentBand} score={r.score} />
                            <span className="risk-title">{r.title}</span>
                          </div>
                          <span className="tag">{r.orgUnit.name}</span>
                        </div>
                      ))}
                      {operational.recentRisks.length === 0 && <p className="helper-note">No open risks yet.</p>}
                    </div>
                  </div>
                </>
              )}
            </div>

            {view === 'executive' && (
              <div className="card">
                <div className="section-title">Top 5 highest-scoring open risks</div>
                <div className="rowlist">
                  {data.topOpenRisks.map((r) => {
                    const band: ScoreBand = r.score >= 15 ? 'CRITICAL' : r.score >= 8 ? 'HIGH' : r.score >= 4 ? 'MEDIUM' : 'LOW';
                    return (
                      <div key={r.id} className="rowlist-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <BandBadge band={band} score={r.score} />
                          <Link href={`/risk-register/${r.id}`} className="risk-title">
                            {r.title}
                          </Link>
                        </div>
                        <span className="tag">{r.orgUnit.name}</span>
                      </div>
                    );
                  })}
                  {data.topOpenRisks.length === 0 && <p className="helper-note">No open risks yet.</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
