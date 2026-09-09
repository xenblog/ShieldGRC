'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { OrgUnit, TreatmentAction, TreatmentActionStatus, UserSummary } from '@/lib/types';
import { TREATMENT_STATUS_CLASS, TREATMENT_STATUS_LABEL } from '@/lib/status-labels';

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
    <>
      <div className="topbar">
        <div className="page-title">Treatment Actions</div>
      </div>

      <div className="content">
        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="filter-bar">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="select">
              <option value="">Owner: All</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="select">
              <option value="">Status: All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TREATMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="select">
              <option value="">Org unit: All</option>
              {orgUnits?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
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
            <table className="grc-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Action Description</th>
                  <th>Risk</th>
                  <th>Assessment</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {actions?.map((a) => (
                  <tr key={a.id}>
                    <td className="risk-title">{a.description}</td>
                    <td>
                      {a.risk && (
                        <Link href={`/risk-register/${a.risk.id}`} className="tag">
                          {a.risk.code}
                        </Link>
                      )}
                    </td>
                    <td>
                      {a.assessment ? (
                        <Link href={`/risk-assessment/assessments/${a.assessment.id}`} className="tag">
                          {a.assessment.code}
                        </Link>
                      ) : (
                        <span className="helper-note">Standalone</span>
                      )}
                    </td>
                    <td>
                      <div className="owner-cell">{a.owner.name}</div>
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={a.status}
                          onChange={(e) => updateStatus(a.id, e.target.value as TreatmentActionStatus)}
                          className="select"
                          style={{ fontSize: 12, padding: '4px 26px 4px 8px' }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {TREATMENT_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`status ${TREATMENT_STATUS_CLASS[a.status]}`}>{TREATMENT_STATUS_LABEL[a.status]}</span>
                      )}
                    </td>
                    <td className={a.isOverdue ? 'overdue' : undefined}>{new Date(a.dueDate).toLocaleDateString()}</td>
                  </tr>
                ))}
                {actions?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="helper-note" style={{ padding: 18 }}>
                      No treatment actions match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
