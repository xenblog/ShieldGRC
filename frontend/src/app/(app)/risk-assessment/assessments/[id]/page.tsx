'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { BandBadge } from '@/components/BandBadge';
import { Risk, RiskAssessmentDetail, TreatmentActionStatus, UserSummary } from '@/lib/types';

const TA_STATUSES: TreatmentActionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';
  const { data: assessment, loading, setData } = useApiGet<RiskAssessmentDetail>(
    `/risk-assessments/${params.id}`,
    [params.id],
  );
  const { data: allRisks } = useApiGet<Risk[]>('/risks');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');

  const [linkingOpen, setLinkingOpen] = useState(false);
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [newActionDescription, setNewActionDescription] = useState('');
  const [newActionRiskId, setNewActionRiskId] = useState('');
  const [newActionOwnerId, setNewActionOwnerId] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!assessment) return null;

  function openLinkModal() {
    setSelectedRiskIds(assessment!.linkedRisks.map((r) => r.id));
    setLinkingOpen(true);
  }

  async function saveLinks() {
    const updated = await api.put<RiskAssessmentDetail>(`/risk-assessments/${params.id}/risks`, {
      riskIds: selectedRiskIds,
    });
    setData(updated);
    setLinkingOpen(false);
  }

  async function addTreatmentAction(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/treatment-actions', {
      description: newActionDescription,
      riskId: newActionRiskId,
      assessmentId: params.id,
      ownerId: newActionOwnerId,
      dueDate: newActionDueDate,
    });
    const refreshed = await api.get<RiskAssessmentDetail>(`/risk-assessments/${params.id}`);
    setData(refreshed);
    setNewActionDescription('');
    setNewActionRiskId('');
    setNewActionOwnerId('');
    setNewActionDueDate('');
  }

  async function updateActionStatus(actionId: string, status: TreatmentActionStatus) {
    await api.patch(`/treatment-actions/${actionId}`, { status });
    const refreshed = await api.get<RiskAssessmentDetail>(`/risk-assessments/${params.id}`);
    setData(refreshed);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{assessment.name}</h1>
        <p className="text-sm text-[var(--dgs-text-muted)]">
          {assessment.orgUnit.name} · Lead assessor {assessment.leadAssessor.name}
        </p>
      </div>

      <div className="dgs-card p-4">
        <p className="text-sm">{assessment.scope}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Status</p>
          <p className="mt-1 text-sm font-medium">{assessment.status}</p>
        </div>
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Progress</p>
          <p className="mt-1 text-sm font-medium">
            {assessment.progressPercent}% {assessment.progressOverride && '(manual override)'}
          </p>
        </div>
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Start date</p>
          <p className="mt-1 text-sm">{new Date(assessment.startDate).toLocaleDateString()}</p>
        </div>
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Due date</p>
          <p className="mt-1 text-sm">{new Date(assessment.dueDate).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="dgs-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Linked risks</p>
          {canEdit && (
            <button onClick={openLinkModal} className="text-xs text-[var(--dgs-primary)] hover:underline">
              Edit links
            </button>
          )}
        </div>
        {linkingOpen && allRisks && (
          <div className="mb-3 max-h-56 overflow-y-auto rounded border p-2">
            {allRisks.map((r) => (
              <label key={r.id} className="flex items-center gap-2 py-0.5 text-sm">
                <input
                  type="checkbox"
                  checked={selectedRiskIds.includes(r.id)}
                  onChange={(e) =>
                    setSelectedRiskIds((prev) =>
                      e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                    )
                  }
                />
                {r.title}
              </label>
            ))}
            <div className="mt-2 flex gap-2">
              <button onClick={saveLinks} className="rounded bg-[var(--dgs-primary)] px-2 py-1 text-xs text-white">
                Save
              </button>
              <button onClick={() => setLinkingOpen(false)} className="rounded border px-2 py-1 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}
        {assessment.linkedRisks.length === 0 ? (
          <p className="text-sm text-gray-400">No risks linked yet.</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Inherent</th>
              </tr>
            </thead>
            <tbody>
              {assessment.linkedRisks.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/risk-register/${r.id}`} className="hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td>{r.status}</td>
                  <td>
                    <BandBadge band={r.inherentBand} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Treatment actions</p>
        <table className="dgs-table w-full">
          <thead>
            <tr>
              <th>Description</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {assessment.treatmentActions.map((a) => (
              <tr key={a.id}>
                <td>{a.description}</td>
                <td>{a.owner.name}</td>
                <td>
                  {canEdit ? (
                    <select
                      value={a.status}
                      onChange={(e) => updateActionStatus(a.id, e.target.value as TreatmentActionStatus)}
                      className="rounded border px-1 py-0.5 text-xs"
                    >
                      {TA_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    a.status
                  )}
                </td>
                <td>{new Date(a.dueDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {canEdit && (
          <form onSubmit={addTreatmentAction} className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
            <input
              required
              placeholder="New treatment action description"
              value={newActionDescription}
              onChange={(e) => setNewActionDescription(e.target.value)}
              className="col-span-2 rounded border px-2 py-1 text-sm"
            />
            <select
              required
              value={newActionRiskId}
              onChange={(e) => setNewActionRiskId(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">Linked risk…</option>
              {assessment.linkedRisks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <select
              required
              value={newActionOwnerId}
              onChange={(e) => setNewActionOwnerId(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="">Owner…</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input
              required
              type="date"
              value={newActionDueDate}
              onChange={(e) => setNewActionDueDate(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--dgs-primary-hover)]"
            >
              Add action
            </button>
          </form>
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Audit history</p>
        {assessment.auditHistory.length === 0 ? (
          <p className="text-sm text-gray-400">None</p>
        ) : (
          <ul className="space-y-1 text-sm text-[var(--dgs-text-muted)]">
            {assessment.auditHistory.map((entry) => (
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
