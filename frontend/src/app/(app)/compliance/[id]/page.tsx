'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { FrameworkDetail } from '@/lib/types';

const EFFECTIVENESS_COLOR: Record<string, string> = {
  EFFECTIVE: 'text-green-700 bg-green-50',
  PARTIALLY_EFFECTIVE: 'text-amber-700 bg-amber-50',
  INEFFECTIVE: 'text-red-700 bg-red-50',
  NOT_YET_TESTED: 'text-gray-600 bg-gray-100',
};

export default function FrameworkDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: framework, loading } = useApiGet<FrameworkDetail>(`/frameworks/${params.id}`, [params.id]);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!framework) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{framework.name}</h1>
        <p className="text-sm text-[var(--dgs-text-muted)]">
          {framework.orgUnit.name} · Owner {framework.owner.name}
        </p>
      </div>

      <div className="dgs-card p-4">
        <p className="text-sm">{framework.description}</p>
      </div>

      <div className="dgs-card p-4">
        <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Overall coverage</p>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-[var(--dgs-primary)]" style={{ width: `${framework.coveragePercent}%` }} />
        </div>
        <p className="mt-1 text-sm">
          {framework.coveragePercent}% of {framework.mappedControlCount} mapped controls are currently Effective
        </p>
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Mapped controls</p>
        {framework.mappedControls.length === 0 ? (
          <p className="text-sm text-gray-400">No controls mapped yet.</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Domain</th>
                <th>Effectiveness</th>
                <th>Last tested</th>
              </tr>
            </thead>
            <tbody>
              {framework.mappedControls.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/controls/${c.id}`} className="hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td>{c.name}</td>
                  <td>{c.domainCategory?.name}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${EFFECTIVENESS_COLOR[c.effectiveness]}`}>
                      {c.effectiveness}
                    </span>
                  </td>
                  <td>{c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Audit history</p>
        {framework.auditHistory.length === 0 ? (
          <p className="text-sm text-gray-400">None</p>
        ) : (
          <ul className="space-y-1 text-sm text-[var(--dgs-text-muted)]">
            {framework.auditHistory.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.createdAt).toLocaleString()} — {entry.action} by {entry.actor?.name ?? 'system'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
