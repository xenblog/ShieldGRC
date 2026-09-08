'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { OrgUnit, TreatmentAction, TreatmentActionStatus, UserSummary } from '@/lib/types';

const STATUSES: TreatmentActionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];

export default function TreatmentActionsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');

  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (ownerId) params.set('ownerId', ownerId);
    if (status) params.set('status', status);
    if (orgUnitId) params.set('orgUnitId', orgUnitId);
    return params.toString();
  }, [ownerId, status, orgUnitId]);

  const path = `/treatment-actions${query ? `?${query}` : ''}`;
  const { data: actions, loading, setData } = useApiGet<TreatmentAction[]>(path, [path]);

  async function updateStatus(id: string, newStatus: TreatmentActionStatus) {
    await api.patch(`/treatment-actions/${id}`, { status: newStatus });
    setData((prev) => prev?.map((a) => (a.id === id ? { ...a, status: newStatus } : a)) ?? null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Treatment Actions</h1>

      <div className="dgs-card flex flex-wrap gap-3 p-3">
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All owners</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
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
        <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All org units</option>
          {orgUnits?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div className="dgs-card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Description</th>
                <th>Risk</th>
                <th>Assessment</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {actions?.map((a) => (
                <tr key={a.id}>
                  <td>{a.description}</td>
                  <td>
                    {a.risk && (
                      <Link href={`/risk-register/${a.risk.id}`} className="hover:underline">
                        {a.risk.title}
                      </Link>
                    )}
                  </td>
                  <td>
                    {a.assessment ? (
                      <Link href={`/risk-assessment/assessments/${a.assessment.id}`} className="hover:underline">
                        {a.assessment.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Standalone</span>
                    )}
                  </td>
                  <td>{a.owner.name}</td>
                  <td>
                    {canEdit ? (
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus(a.id, e.target.value as TreatmentActionStatus)}
                        className="rounded border px-1 py-0.5 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      a.status
                    )}
                  </td>
                  <td className={a.isOverdue ? 'font-semibold text-red-600' : ''}>
                    {new Date(a.dueDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
