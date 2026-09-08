'use client';

import { useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { AuditLogEntry } from '@/lib/types';

interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
}

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const path = `/audit-logs${entityType ? `?entityType=${entityType}` : ''}`;
  const { data, loading } = useApiGet<AuditLogResponse>(path, [path]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>

      <div className="dgs-card flex flex-wrap gap-3 p-3">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All entity types</option>
          <option value="Risk">Risk</option>
          <option value="RiskAssessment">RiskAssessment</option>
          <option value="TreatmentAction">TreatmentAction</option>
          <option value="Control">Control</option>
          <option value="ControlTest">ControlTest</option>
          <option value="Framework">Framework</option>
        </select>
      </div>

      <div className="dgs-card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>When</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>
                    {entry.entityType} <span className="text-gray-400">({entry.entityId.slice(0, 8)})</span>
                  </td>
                  <td>{entry.action}</td>
                  <td>{entry.actor?.name ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && <p className="text-xs text-[var(--dgs-text-muted)]">Showing {data.items.length} of {data.total} entries</p>}
    </div>
  );
}
