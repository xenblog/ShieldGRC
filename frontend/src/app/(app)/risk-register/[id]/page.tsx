'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { BandBadge } from '@/components/BandBadge';
import { RiskFields, RiskFieldValues, SCALE_LABELS } from '@/components/risks/RiskFields';
import { Category, OrgUnit, RiskDetail, TreatmentActionStatus, UserSummary } from '@/lib/types';
import {
  RISK_STATUS_CLASS,
  RISK_STATUS_LABEL,
  TREATMENT_STATUS_CLASS,
  TREATMENT_STATUS_LABEL,
  treatmentStrategyLabel,
} from '@/lib/status-labels';

function toFieldValues(risk: RiskDetail): RiskFieldValues {
  return {
    title: risk.title,
    description: risk.description,
    categoryId: risk.categoryId,
    orgUnitId: risk.orgUnitId,
    ownerId: risk.ownerId,
    status: risk.status,
    likelihood: risk.likelihood,
    impact: risk.impact,
    treatmentStrategy: risk.treatmentStrategy ?? '',
    treatmentNote: risk.treatmentNote ?? '',
    residualScore: risk.residualScore ?? '',
    notes: risk.notes ?? '',
    nextReviewDate: risk.nextReviewDate ? risk.nextReviewDate.slice(0, 10) : '',
  };
}

function toPayload(values: RiskFieldValues) {
  return {
    ...values,
    treatmentStrategy: values.treatmentStrategy || undefined,
    residualScore: values.residualScore === '' ? undefined : values.residualScore,
    nextReviewDate: values.nextReviewDate || undefined,
  };
}

export default function RiskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const { data: risk, loading, setData } = useApiGet<RiskDetail>(`/risks/${params.id}`, [params.id]);
  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');

  const [values, setValues] = useState<RiskFieldValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingAction, setAddingAction] = useState(false);
  const [actionDescription, setActionDescription] = useState('');
  const [actionOwnerId, setActionOwnerId] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');

  const current = values ?? (risk ? toFieldValues(risk) : null);

  if (loading) return <p className="helper-note">Loading…</p>;
  if (!risk || !current) return null;

  function onChange<K extends keyof RiskFieldValues>(key: K, value: RiskFieldValues[K]) {
    setValues({ ...current!, [key]: value });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<RiskDetail>(`/risks/${params.id}`, toPayload(current!));
      setData(updated);
      setValues(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save risk');
    } finally {
      setSaving(false);
    }
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

  async function addAction(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/treatment-actions', {
      description: actionDescription,
      riskId: params.id,
      ownerId: actionOwnerId,
      dueDate: actionDueDate,
    });
    const refreshed = await api.get<RiskDetail>(`/risks/${params.id}`);
    setData(refreshed);
    setActionDescription('');
    setActionOwnerId('');
    setActionDueDate('');
    setAddingAction(false);
  }

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <Link href="/risk-register" className="crumb-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Risk Register
          </Link>
          <span className="crumb-sep">|</span>
          <span className="crumb-id">{risk.code}</span>
          <span className={`status ${RISK_STATUS_CLASS[risk.status]}`}>{RISK_STATUS_LABEL[risk.status]}</span>
          {risk.isOverdue && <span className="overdue">Review overdue</span>}
        </div>
        {canEdit && (
          <div className="topbar-right">
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              Delete Risk
            </button>
            <button type="submit" form="risk-detail-form" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="content" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div className="col-left" style={{ flex: 1.5 }}>
          <form id="risk-detail-form" onSubmit={handleSave} className="card">
            <div className="card-header">
              <div className="section-title">Risk Details</div>
              <span className="created-note">Created {new Date(risk.createdAt).toLocaleDateString()}</span>
            </div>
            <RiskFields values={current} onChange={onChange} categories={categories} orgUnits={orgUnits} users={users} disabled={!canEdit} />
            {error && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {error}
              </p>
            )}
          </form>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Treatment Actions for this Risk</div>
              {canEdit && (
                <button type="button" onClick={() => setAddingAction((v) => !v)} className="btn-secondary">
                  + Add Action
                </button>
              )}
            </div>
            {addingAction && (
              <form onSubmit={addAction} className="field-row" style={{ marginBottom: 16, alignItems: 'end' }}>
                <input
                  required
                  placeholder="Action description"
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  className="input"
                  style={{ fontFamily: 'var(--font-chrome)', gridColumn: '1 / -1' }}
                />
                <select required className="select-input" value={actionOwnerId} onChange={(e) => setActionOwnerId(e.target.value)}>
                  <option value="">Owner…</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <input required type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} />
                <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>
                  Add
                </button>
              </form>
            )}
            {risk.treatmentActions.length === 0 ? (
              <p className="helper-note">None yet.</p>
            ) : (
              risk.treatmentActions.map((a) => (
                <div key={a.id} className="linked-item">
                  <div>
                    <span style={{ fontFamily: 'var(--font-content)', fontSize: 13, color: 'var(--dgs-black)' }}>{a.description}</span>
                    <div className="helper-note" style={{ marginTop: 2 }}>
                      Due {new Date(a.dueDate).toLocaleDateString()} · {a.owner.name}
                    </div>
                  </div>
                  {canEdit ? (
                    <select
                      value={a.status}
                      onChange={(e) => updateActionStatus(a.id, e.target.value as TreatmentActionStatus)}
                      className="select"
                      style={{ fontSize: 12, padding: '4px 26px 4px 8px' }}
                    >
                      {(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'] as TreatmentActionStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {TREATMENT_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`status ${TREATMENT_STATUS_CLASS[a.status]}`}>{TREATMENT_STATUS_LABEL[a.status]}</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Audit History</div>
            </div>
            {risk.auditHistory.length === 0 ? (
              <p className="helper-note">None yet.</p>
            ) : (
              risk.auditHistory.map((entry) => (
                <div key={entry.id} className="linked-item">
                  <div>
                    <span style={{ fontFamily: 'var(--font-chrome)', fontSize: 12.5, color: 'var(--dgs-black)' }}>
                      {entry.actor?.name ?? 'System'} {entry.action.toLowerCase()}d the risk
                    </span>
                    <div className="helper-note" style={{ marginTop: 2 }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-right" style={{ flex: 1 }}>
          <div className="card">
            <div className="card-header">
              <div className="section-title">Risk Score</div>
            </div>
            <div className="score-tile-row">
              <div className="score-tile">
                <div className="score-tile-label">Likelihood</div>
                <div className="score-tile-value">{risk.likelihood}</div>
                <div className="score-tile-sub">{SCALE_LABELS[risk.likelihood]}</div>
              </div>
              <div className="score-tile">
                <div className="score-tile-label">Impact</div>
                <div className="score-tile-value">{risk.impact}</div>
                <div className="score-tile-sub">{SCALE_LABELS[risk.impact]}</div>
              </div>
            </div>
            <div className="score-row">
              <span className="score-row-label">Inherent Score</span>
              <BandBadge band={risk.inherentBand} score={risk.inherentScore} showLabel />
            </div>
            <div className="score-row">
              <span className="score-row-label">Residual Score</span>
              {risk.residualBand && risk.residualScore != null ? (
                <BandBadge band={risk.residualBand} score={risk.residualScore} showLabel />
              ) : (
                <span className="helper-note" style={{ margin: 0 }}>
                  Not set
                </span>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Risk Summary</div>
            </div>
            <div className="summary-row">
              <span className="summary-label">Risk ID</span>
              <span className="summary-value">{risk.code}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Org Unit</span>
              <span className="summary-value">{risk.orgUnit.name}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Treatment</span>
              <span className="summary-value">{treatmentStrategyLabel(risk.treatmentStrategy)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Status</span>
              <span className="summary-value">{RISK_STATUS_LABEL[risk.status]}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Owner</span>
              <span className="summary-value">{risk.owner.name}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Last updated</span>
              <span className="summary-value">{new Date(risk.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
