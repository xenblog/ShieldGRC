'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { apiDownload } from '@/lib/api-client';
import { ControlDetail } from '@/lib/types';

export default function ControlDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: control, loading } = useApiGet<ControlDetail>(`/controls/${params.id}`, [params.id]);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!control) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {control.code} — {control.name}
          </h1>
          <p className="text-sm text-[var(--dgs-text-muted)]">
            {control.domainCategory.name} · {control.orgUnit.name} · {control.type} · {control.frequency}
          </p>
        </div>
        <Link
          href={`/control-testing?controlId=${control.id}`}
          className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
        >
          Add test
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Effectiveness</p>
          <p className="mt-1 text-sm font-medium">{control.effectiveness}</p>
        </div>
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Last tested</p>
          <p className="mt-1 text-sm">{control.lastTestedAt ? new Date(control.lastTestedAt).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Mapped frameworks</p>
        {control.frameworks.length === 0 ? (
          <p className="text-sm text-gray-400">None</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {control.frameworks.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/compliance/${f.id}`}
                  className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                >
                  {f.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Test history</p>
        {control.tests.length === 0 ? (
          <p className="text-sm text-gray-400">No tests recorded yet.</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Result</th>
                <th>Method</th>
                <th>Tester</th>
                <th>Tested date</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {control.tests.map((t) => (
                <tr key={t.id}>
                  <td>{t.cycle}</td>
                  <td>{t.result}</td>
                  <td>{t.testMethod}</td>
                  <td>{t.tester.name}</td>
                  <td>{new Date(t.testedDate).toLocaleDateString()}</td>
                  <td>
                    {t.evidence.length === 0 ? (
                      '—'
                    ) : (
                      <ul className="space-y-0.5">
                        {t.evidence.map((ev) => (
                          <li key={ev.id}>
                            <button
                              onClick={() =>
                                apiDownload(`/control-tests/${t.id}/evidence/${ev.id}/download`, ev.filename)
                              }
                              className="text-xs text-[var(--dgs-primary)] hover:underline"
                            >
                              {ev.filename}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Audit history</p>
        {control.auditHistory.length === 0 ? (
          <p className="text-sm text-gray-400">None</p>
        ) : (
          <ul className="space-y-1 text-sm text-[var(--dgs-text-muted)]">
            {control.auditHistory.map((entry) => (
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
