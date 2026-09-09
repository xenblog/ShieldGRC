'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { BandBadge } from '@/components/BandBadge';
import { AssessmentStatus, MethodologyVersion, Risk, RiskAssessmentDetail, TreatmentActionStatus, UserSummary } from '@/lib/types';
import { ASSESSMENT_STATUS_CLASS, ASSESSMENT_STATUS_LABEL, RISK_STATUS_LABEL, TREATMENT_STATUS_LABEL } from '@/lib/status-labels';

const TA_STATUSES: TreatmentActionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
const ASSESSMENT_STATUSES: AssessmentStatus[] = ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'];
const PRESETS = [0, 25, 50, 75, 100];

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';
  const { data: assessment, loading, setData } = useApiGet<RiskAssessmentDetail>(`/risk-assessments/${params.id}`, [params.id]);
  const { data: allRisks } = useApiGet<Risk[]>('/risks');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const { data: methodology } = useApiGet<MethodologyVersion>('/methodology/current');

  const [name, setName] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [leadAssessorId, setLeadAssessorId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [status, setStatus] = useState<AssessmentStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkingOpen, setLinkingOpen] = useState(false);
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [addingAction, setAddingAction] = useState(false);
  const [newActionDescription, setNewActionDescription] = useState('');
  const [newActionRiskId, setNewActionRiskId] = useState('');
  const [newActionOwnerId, setNewActionOwnerId] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');

  if (loading) return <p className="helper-note">Loading…</p>;
  if (!assessment) return null;

  const currentName = name ?? assessment.name;
  const currentScope = scope ?? assessment.scope;
  const currentLeadAssessorId = leadAssessorId ?? assessment.leadAssessorId;
  const currentStartDate = startDate ?? assessment.startDate.slice(0, 10);
  const currentDueDate = dueDate ?? assessment.dueDate.slice(0, 10);
  const currentStatus = status ?? assessment.status;
  const currentProgress = progress ?? assessment.progressPercent;

  function openLinkModal() {
    setSelectedRiskIds(assessment!.linkedRisks.map((r) => r.id));
    setLinkingOpen(true);
  }

  async function saveLinks() {
    const updated = await api.put<RiskAssessmentDetail>(`/risk-assessments/${params.id}/risks`, { riskIds: selectedRiskIds });
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
    setAddingAction(false);
  }

  async function updateActionStatus(actionId: string, newStatus: TreatmentActionStatus) {
    await api.patch(`/treatment-actions/${actionId}`, { status: newStatus });
    const refreshed = await api.get<RiskAssessmentDetail>(`/risk-assessments/${params.id}`);
    setData(refreshed);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Only pin progress as a manual override if the assessor actually
      // touched the slider/presets this session - saving unrelated field
      // edits (name, dates, ...) must not silently override an
      // auto-computed progress value they never looked at.
      const touchedProgress = progress !== null;
      const updated = await api.patch<RiskAssessmentDetail>(`/risk-assessments/${params.id}`, {
        name: currentName,
        scope: currentScope,
        leadAssessorId: currentLeadAssessorId,
        startDate: currentStartDate,
        dueDate: currentDueDate,
        status: currentStatus,
        ...(touchedProgress ? { progressOverride: true, progressManualValue: currentProgress } : {}),
      });
      setData(updated);
      setName(null);
      setScope(null);
      setLeadAssessorId(null);
      setStartDate(null);
      setDueDate(null);
      setStatus(null);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  }

  const snapshot = {
    critical: assessment.linkedRisks.filter((r) => r.inherentBand === 'CRITICAL').length,
    high: assessment.linkedRisks.filter((r) => r.inherentBand === 'HIGH').length,
    linked: assessment.linkedRisks.length,
  };

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <Link href="/risk-assessment/assessments" className="crumb-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Assessments
          </Link>
          <span className="crumb-sep">|</span>
          <span className="crumb-id">{assessment.code}</span>
          <span className={`status ${ASSESSMENT_STATUS_CLASS[assessment.status]}`}>{ASSESSMENT_STATUS_LABEL[assessment.status]}</span>
          {assessment.isOverdue && <span className="overdue">Overdue</span>}
        </div>
        {canEdit && (
          <button type="submit" form="assessment-detail-form" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="content">
        <form id="assessment-detail-form" onSubmit={handleSave}>
          <div className="two-col">
            <div className="card">
              <div className="card-header">
                <div className="section-title">Assessment Details</div>
                <span className="created-note">Created {new Date(assessment.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="field">
                <label className="field-label">Assessment Name</label>
                <input className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={currentName} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="field">
                <label className="field-label">Scope</label>
                <input className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={currentScope} onChange={(e) => setScope(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="field">
                <label className="field-label">Lead Assessor</label>
                <select className="select-input" value={currentLeadAssessorId} onChange={(e) => setLeadAssessorId(e.target.value)} disabled={!canEdit}>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Start Date</label>
                  <input type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={currentStartDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canEdit} />
                </div>
                <div className="field">
                  <label className="field-label">Due Date</label>
                  <input type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={currentDueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Status</label>
                <select className="select-input" value={currentStatus} onChange={(e) => setStatus(e.target.value as AssessmentStatus)} disabled={!canEdit}>
                  {ASSESSMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ASSESSMENT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="section-title">Assessment Progress</div>
              </div>
              <div className="progress-ring-wrap">
                <div className="progress-num">{currentProgress}%</div>
                <div className="progress-caption">Complete</div>
              </div>
              <div
                className="slider-track"
                onClick={(e) => {
                  if (!canEdit) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                  setProgress(Math.min(100, Math.max(0, pct)));
                }}
              >
                <div className="slider-fill" style={{ width: `${currentProgress}%` }} />
                <div className="slider-handle" style={{ left: `${currentProgress}%` }} />
              </div>
              <div className="slider-scale">
                {PRESETS.map((p) => (
                  <span key={p}>{p}%</span>
                ))}
              </div>
              <div className="preset-row">
                {PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    disabled={!canEdit}
                    onClick={() => setProgress(p)}
                    className={`preset-chip${currentProgress === p ? ' active' : ''}`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <div className="helper-note">Drag the slider or pick a preset · saved on &quot;Save Changes&quot;</div>
            </div>
          </div>
          {error && (
            <p className="helper-note" style={{ color: 'var(--dgs-red)', marginTop: 10 }}>
              {error}
            </p>
          )}
        </form>

        <div className="two-col">
          <div className="card">
            <div className="card-header">
              <div className="section-title">Linked Risks</div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={openLinkModal} className="btn-secondary">
                    + Link from Register
                  </button>
                  <Link href="/risk-register/new" className="btn-secondary">
                    + New Risk
                  </Link>
                </div>
              )}
            </div>
            {linkingOpen && allRisks && (
              <div style={{ marginBottom: 14, maxHeight: 220, overflowY: 'auto', border: '1px solid var(--dgs-salt)', borderRadius: 7, padding: 10 }}>
                {allRisks.map((r) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontFamily: 'var(--font-chrome)', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={selectedRiskIds.includes(r.id)}
                      onChange={(e) =>
                        setSelectedRiskIds((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)))
                      }
                    />
                    {r.code} — {r.title}
                  </label>
                ))}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button type="button" onClick={saveLinks} className="btn-primary">
                    Save
                  </button>
                  <button type="button" onClick={() => setLinkingOpen(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {assessment.linkedRisks.length === 0 ? (
              <p className="helper-note">No risks linked yet.</p>
            ) : (
              <table className="grc-table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Owner</th>
                    <th>Score</th>
                    <th>Status</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {assessment.linkedRisks.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-chrome)', color: 'var(--dgs-umami)' }}>{r.code}</td>
                      <td>
                        <Link href={`/risk-register/${r.id}`} className="risk-title">
                          {r.title}
                        </Link>
                      </td>
                      <td>
                        <span className="tag">{r.category.name}</span>
                      </td>
                      <td>
                        <div className="owner-cell">{r.owner.name}</div>
                      </td>
                      <td>
                        <BandBadge band={r.inherentBand} score={r.inherentScore} />
                      </td>
                      <td>
                        <span className="tag">{RISK_STATUS_LABEL[r.status]}</span>
                      </td>
                      {canEdit && (
                        <td>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={async () => {
                              const updated = await api.put<RiskAssessmentDetail>(`/risk-assessments/${params.id}/risks`, {
                                riskIds: assessment.linkedRisks.filter((x) => x.id !== r.id).map((x) => x.id),
                              });
                              setData(updated);
                            }}
                          >
                            Unlink
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="col-right">
            <div className="card">
              <div className="card-header">
                <div className="section-title">Risk Snapshot</div>
                <span className="created-note">{snapshot.linked} linked</span>
              </div>
              <div className="snapshot-row">
                <div className="snapshot-tile" style={{ background: 'rgba(173,25,34,0.1)' }}>
                  <div className="snapshot-num" style={{ color: 'var(--dgs-red)' }}>
                    {snapshot.critical}
                  </div>
                  <div className="snapshot-label">Critical</div>
                </div>
                <div className="snapshot-tile" style={{ background: 'rgba(107,88,73,0.14)' }}>
                  <div className="snapshot-num" style={{ color: 'var(--dgs-umami)' }}>
                    {snapshot.high}
                  </div>
                  <div className="snapshot-label">High</div>
                </div>
                <div className="snapshot-tile" style={{ background: 'var(--dgs-salt-tint)' }}>
                  <div className="snapshot-num">{snapshot.linked}</div>
                  <div className="snapshot-label">Linked</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="section-title">Methodology</div>
                {methodology && (
                  <span className="std-badge">
                    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    {methodology.frameworkReference}
                  </span>
                )}
              </div>
              <div className="methodology-row">
                <span className="methodology-label">Scoring</span>
                <span className="methodology-value">Likelihood × Impact (1–5)</span>
              </div>
              <div className="methodology-row">
                <span className="methodology-label">Critical</span>
                <span className="methodology-value">Score ≥ 15</span>
              </div>
              <div className="methodology-row" style={{ borderBottom: 'none' }}>
                <Link href="/risk-assessment/methodology" className="link-action">
                  View full methodology →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="section-title">Treatment Actions</div>
            {canEdit && (
              <button type="button" onClick={() => setAddingAction((v) => !v)} className="btn-secondary">
                + Add Action
              </button>
            )}
          </div>
          {addingAction && (
            <form onSubmit={addTreatmentAction} className="field-row" style={{ marginBottom: 16, alignItems: 'end' }}>
              <input
                required
                placeholder="New treatment action description"
                value={newActionDescription}
                onChange={(e) => setNewActionDescription(e.target.value)}
                className="input"
                style={{ fontFamily: 'var(--font-chrome)', gridColumn: '1 / -1' }}
              />
              <select required className="select-input" value={newActionRiskId} onChange={(e) => setNewActionRiskId(e.target.value)}>
                <option value="">Linked risk…</option>
                {assessment.linkedRisks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.title}
                  </option>
                ))}
              </select>
              <select required className="select-input" value={newActionOwnerId} onChange={(e) => setNewActionOwnerId(e.target.value)}>
                <option value="">Owner…</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <input required type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={newActionDueDate} onChange={(e) => setNewActionDueDate(e.target.value)} />
              <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>
                Add
              </button>
            </form>
          )}
          {assessment.treatmentActions.length === 0 ? (
            <p className="helper-note">None yet.</p>
          ) : (
            <table className="grc-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Action</th>
                  <th>Risk</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assessment.treatmentActions.map((a) => (
                  <tr key={a.id}>
                    <td className="risk-title">{a.description}</td>
                    <td>
                      <span className="tag">{a.risk.code}</span>
                    </td>
                    <td>{new Date(a.dueDate).toLocaleDateString()}</td>
                    <td>
                      {canEdit ? (
                        <select
                          value={a.status}
                          onChange={(e) => updateActionStatus(a.id, e.target.value as TreatmentActionStatus)}
                          className="select"
                          style={{ fontSize: 12, padding: '4px 26px 4px 8px' }}
                        >
                          {TA_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {TREATMENT_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="tag">{TREATMENT_STATUS_LABEL[a.status]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="section-title">Audit History</div>
          </div>
          {assessment.auditHistory.length === 0 ? (
            <p className="helper-note">None yet.</p>
          ) : (
            assessment.auditHistory.map((entry) => (
              <div key={entry.id} className="linked-item">
                <div>
                  <span style={{ fontFamily: 'var(--font-chrome)', fontSize: 12.5, color: 'var(--dgs-black)' }}>
                    {entry.actor?.name ?? 'System'} {entry.action.toLowerCase()}d the assessment
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
    </>
  );
}
