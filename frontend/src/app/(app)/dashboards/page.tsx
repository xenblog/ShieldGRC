'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useApiGet } from '@/lib/hooks';
import { BandBadge } from '@/components/BandBadge';
import { ScoreBand } from '@/lib/types';

interface ExecutiveTiles {
  openRisksByBand: Record<ScoreBand, number>;
  riskTrend: { month: string; newRisksCount: number }[];
  heatMapByOrgUnit: { orgUnitId: string; orgUnitName: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }[];
  topOpenRisks: { id: string; title: string; score: number }[];
  controlTestPassRate: { total: number; passed: number; passRatePercent: number };
  frameworkCoverage: { frameworkId: string; name: string; coveragePercent: number }[];
}

interface OperationalTiles extends ExecutiveTiles {
  overdueRiskReviews: { id: string; title: string; nextReviewDate: string }[];
  overdueTreatmentActions: { id: string; description: string; dueDate: string; owner: { name: string }; risk: { id: string; title: string } }[];
  controlsDueForTesting: { id: string; code: string; name: string; nextTestDueDate: string; isOverdue: boolean }[];
  riskTable: { id: string; title: string; inherentBand: ScoreBand; status: string; orgUnit: { name: string } }[];
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dgs-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--dgs-text-muted)]">{title}</p>
      {children}
    </div>
  );
}

export default function DashboardsPage() {
  const { user } = useAuth();
  const isOperational = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER' || user?.role === 'AUDITOR';
  const endpoint = isOperational ? '/dashboards/operational' : '/dashboards/executive';
  const { data, loading, error } = useApiGet<OperationalTiles | ExecutiveTiles>(endpoint, [endpoint]);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const bands: ScoreBand[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const operational = isOperational ? (data as OperationalTiles) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{isOperational ? 'Operational Dashboard' : 'Executive Dashboard'}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title="Open risks by band">
          <div className="space-y-1">
            {bands.map((band) => (
              <div key={band} className="flex items-center justify-between text-sm">
                <BandBadge band={band} />
                <span className="font-semibold">{data.openRisksByBand[band] ?? 0}</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile title="Control test pass rate">
          <p className="text-3xl font-bold text-[var(--dgs-primary)]">{data.controlTestPassRate.passRatePercent}%</p>
          <p className="text-xs text-[var(--dgs-text-muted)]">
            {data.controlTestPassRate.passed} of {data.controlTestPassRate.total} tests passed
          </p>
        </Tile>

        <Tile title="Framework coverage">
          <div className="space-y-1">
            {data.frameworkCoverage.map((f) => (
              <div key={f.frameworkId} className="flex items-center justify-between text-sm">
                <span>{f.name}</span>
                <span className="font-semibold">{f.coveragePercent}%</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile title="Risk trend (new risks / month)">
          <div className="flex items-end gap-1" style={{ height: 60 }}>
            {data.riskTrend.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t bg-[var(--dgs-primary)]"
                  style={{ height: Math.max(4, m.newRisksCount * 10) }}
                  title={`${m.month}: ${m.newRisksCount}`}
                />
                <span className="text-[10px] text-[var(--dgs-text-muted)]">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </Tile>
      </div>

      <Tile title="Top 5 highest-scoring open risks">
        <table className="dgs-table w-full">
          <thead>
            <tr>
              <th>Title</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {data.topOpenRisks.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/risk-register/${r.id}`} className="hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td>{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tile>

      <Tile title="Risk heat map by org unit (open risks)">
        <table className="dgs-table w-full">
          <thead>
            <tr>
              <th>Org Unit</th>
              <th>Low</th>
              <th>Medium</th>
              <th>High</th>
              <th>Critical</th>
            </tr>
          </thead>
          <tbody>
            {data.heatMapByOrgUnit.map((row) => (
              <tr key={row.orgUnitId}>
                <td>{row.orgUnitName}</td>
                <td>{row.LOW}</td>
                <td>{row.MEDIUM}</td>
                <td>{row.HIGH}</td>
                <td>{row.CRITICAL}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tile>

      {operational && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Tile title={`Overdue risk reviews (${operational.overdueRiskReviews.length})`}>
              <ul className="space-y-1 text-sm">
                {operational.overdueRiskReviews.map((r) => (
                  <li key={r.id}>
                    <Link href={`/risk-register/${r.id}`} className="hover:underline">
                      {r.title}
                    </Link>
                  </li>
                ))}
                {operational.overdueRiskReviews.length === 0 && <li className="text-gray-400">None</li>}
              </ul>
            </Tile>
            <Tile title={`Overdue treatment actions (${operational.overdueTreatmentActions.length})`}>
              <ul className="space-y-1 text-sm">
                {operational.overdueTreatmentActions.map((a) => (
                  <li key={a.id}>{a.description}</li>
                ))}
                {operational.overdueTreatmentActions.length === 0 && <li className="text-gray-400">None</li>}
              </ul>
            </Tile>
            <Tile title={`Controls due for testing (${operational.controlsDueForTesting.length})`}>
              <ul className="space-y-1 text-sm">
                {operational.controlsDueForTesting.map((c) => (
                  <li key={c.id} className={c.isOverdue ? 'text-red-600' : ''}>
                    {c.code} — {c.name}
                  </li>
                ))}
                {operational.controlsDueForTesting.length === 0 && <li className="text-gray-400">None</li>}
              </ul>
            </Tile>
          </div>

          <Tile title="Full risk table">
            <table className="dgs-table w-full">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Org Unit</th>
                  <th>Status</th>
                  <th>Band</th>
                </tr>
              </thead>
              <tbody>
                {operational.riskTable.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/risk-register/${r.id}`} className="hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td>{r.orgUnit.name}</td>
                    <td>{r.status}</td>
                    <td>
                      <BandBadge band={r.inherentBand} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tile>
        </>
      )}
    </div>
  );
}
