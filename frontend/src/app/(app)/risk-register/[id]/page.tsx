'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { BandBadge } from '@/components/BandBadge';
import { RiskForm, RiskFormValues, riskToFormValues } from '@/components/risks/RiskForm';
import { RiskDetail, TreatmentActionStatus } from '@/lib/types';

const TA_STATUSES: TreatmentActionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];

function toPayload(values: RiskFormValues) {
  return {
    ...values,
    nistCsfFunction: values.nistCsfFunction || undefined,
    treatmentStrategy: values.treatmentStrategy || undefined,
    residualLikelihood: values.residualLikelihood === '' ? undefined : values.residualLikelihood,
    residualImpact: values.residualImpact === '' ? undefined : values.residualImpact,
    nextReviewDate: values.nextReviewDate || undefined,
  };
}

export default function RiskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const { data: risk, loading, setData } = useApiGet<RiskDetail>(`/risks/${params.id}`, [params.id]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!risk) return null;

  async function handleSave(values: RiskFormValues) {
    const updated = await api.patch<RiskDetail>(`/risks/${params.id}`, toPayload(values));
    setData(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this risk? This also removes its treatment actions and assessment links.')) return;
    setDeleting(true);
    try {
      await api.delete(`/risks/${params.id}`);
      router.push('/risk-register');
    } finally {
      setDeleting(false);
    }
  }

  async function updateActionStatus(actionId: string, status: TreatmentActionStatus) {
    await api.patch(`/treatment-actions/${actionId}`, { status });
    const refreshed = await api.get<RiskDetail>(`/risks/${params.id}`);
    setData(refreshed);
  }

  if (editing) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold">Edit Risk</h1>
        <RiskForm initial={riskToFormValues(risk)} onSubmit={handleSave} submitLabel="Save changes" />
        <button onClick={() => setEditing(false)} className="text-sm text-[var(--dgs-text-muted)] hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {risk.title}
            {risk.isOverdue && (
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Review overdue</span>
            )}
          </h1>
          <p className="text-sm text-[var(--dgs-text-muted)]">
            {risk.orgUnit.name} · {risk.category.name} · Owner {risk.owner.name}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-3">
            <button onClick={() => setEditing(true)} className="text-sm text-[var(--dgs-primary)] hover:underline">
              Edit
            </button>
            <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-600 hover:underline disabled:opacity-60">
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="text-sm">{risk.description}</p>
        {risk.notes && <p className="mt-2 text-sm text-[var(--dgs-text-muted)]">{risk.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Status</p>
          <p className="mt-1 text-sm font-medium">{risk.status}</p>
        </div>
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Inherent score</p>
          <p className="mt-1 text-sm">
            <BandBadge band={risk.inherentBand} /> <span className="text-gray-400">({risk.inherentScore})</span>
          </p>
        </div>
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Residual score (after treatment)</p>
          <p className="mt-1 text-sm">
            {risk.residualBand ? (
              <>
                <BandBadge band={risk.residualBand} /> <span className="text-gray-400">({risk.residualScore})</span>
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Next review</p>
          <p className="mt-1 text-sm">{risk.nextReviewDate ? new Date(risk.nextReviewDate).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {risk.treatmentStrategy && (
        <div className="dgs-card p-4">
          <p className="text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">Treatment</p>
          <p className="mt-1 text-sm">
            {risk.treatmentStrategy}
            {risk.treatmentNote && <span className="text-[var(--dgs-text-muted)]"> — {risk.treatmentNote}</span>}
          </p>
        </div>
      )}

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Linked risk assessments</p>
        {risk.linkedAssessments.length === 0 ? (
          <p className="text-sm text-gray-400">None</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {risk.linkedAssessments.map((a) => (
              <li key={a.id}>
                <Link href={`/risk-assessment/assessments/${a.id}`} className="hover:underline">
                  {a.name}
                </Link>
                <span className="text-[var(--dgs-text-muted)]"> — {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Treatment actions</p>
        {risk.treatmentActions.length === 0 ? (
          <p className="text-sm text-gray-400">None</p>
        ) : (
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
              {risk.treatmentActions.map((a) => (
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
        )}
      </div>

      <div className="dgs-card p-4">
        <p className="mb-2 text-sm font-semibold">Audit history</p>
        {risk.auditHistory.length === 0 ? (
          <p className="text-sm text-gray-400">None</p>
        ) : (
          <ul className="space-y-1 text-sm text-[var(--dgs-text-muted)]">
            {risk.auditHistory.map((entry) => (
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
