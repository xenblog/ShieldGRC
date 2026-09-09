'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { BandBadge } from '@/components/BandBadge';
import { Modal } from '@/components/Modal';
import { RiskFields, RiskFieldValues, emptyRiskFieldValues } from '@/components/risks/RiskFields';
import { Category, OrgUnit, AssessmentStatus, MethodologyVersion, PaginatedRisks, Risk, RiskAssessmentDetail, TreatmentActionStatus, UserSummary } from '@/lib/types';
import { ASSESSMENT_STATUS_CLASS, ASSESSMENT_STATUS_LABEL, RISK_STATUS_LABEL, TREATMENT_STATUS_LABEL } from '@/lib/status-labels';

const TA_STATUSES: TreatmentActionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
const ASSESSMENT_STATUSES: AssessmentStatus[] = ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'];
const PRESETS = [0, 25, 50, 75, 100];

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';
  const { data: assessment, loading, setData } = useApiGet<RiskAssessmentDetail>(`/risk-assessments/${params.id}`, [params.id]);
  const { data: allRisksPage } = useApiGet<PaginatedRisks>('/risks?pageSize=0');
  const allRisks = allRisksPage?.items ?? null;
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const { data: methodology } = useApiGet<MethodologyVersion>('/methodology/current');
  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');

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
  const [linkSearch, setLinkSearch] = useState('');
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);

  const [addingAction, setAddingAction] = useState(false);
  const [newActionDescription, setNewActionDescription] = useState('');
  const [newActionRiskId, setNewActionRiskId] = useState('');
  const [newActionOwnerId, setNewActionOwnerId] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [addActionError, setAddActionError] = useState<string | null>(null);
  const [addActionSaving, setAddActionSaving] = useState(false);

  const [newRiskOpen, setNewRiskOpen] = useState(false);
  const [newRiskValues, setNewRiskValues] = useState<RiskFieldValues>(emptyRiskFieldValues());
  const [newRiskSaving, setNewRiskSaving] = useState(false);
  const [newRiskError, setNewRiskError] = useState<string | null>(null);

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
    setLinkSearch('');
    setLinkingOpen(true);
  }

  async function saveLinks() {
    const updated = await api.put<RiskAssessmentDetail>(`/risk-assessments/${params.id}/risks`, { riskIds: selectedRiskIds });
    setData(updated);
    setLinkingOpen(false);
  }

  function openNewRiskModal() {
    setNewRiskValues(emptyRiskFieldValues());
    setNewRiskError(null);
    setNewRiskOpen(true);
  }

  async function submitNewRisk(e: React.FormEvent) {
    e.preventDefault();
    setNewRiskSaving(true);
    setNewRiskError(null);
    try {
      const risk = await api.post<Risk>('/risks', {
        ...newRiskValues,
        treatmentStrategy: newRiskValues.treatmentStrategy || undefined,
        residualScore: newRiskValues.residualScore === '' ? undefined : newRiskValues.residualScore,
        nextReviewDate: newRiskValues.nextReviewDate || undefined,
      });
      const updated = await api.put<RiskAssessmentDetail>(`/risk-assessments/${params.id}/risks`, {
        riskIds: [...assessment!.linkedRisks.map((r) => r.id), risk.id],
      });
      setData(updated);
      setNewRiskOpen(false);
    } catch (err) {
      setNewRiskError(err instanceof Error ? err.message : 'Failed to create risk');
    } finally {
      setNewRiskSaving(false);
    }
  }

  function openAddActionModal() {
    setNewActionDescription('');
    setNewActionRiskId(assessment!.linkedRisks[0]?.id ?? '');
    setNewActionOwnerId('');
    setNewActionDueDate('');
    setAddActionError(null);
    setAddingAction(true);
  }

  async function addTreatmentAction(e: React.FormEvent) {
    e.preventDefault();
    setAddActionSaving(true);
    setAddActionError(null);
    try {
      await api.post('/treatment-actions', {
        description: newActionDescription,
        riskId: newActionRiskId,
        assessmentId: params.id,
        ownerId: newActionOwnerId,
        dueDate: newActionDueDate,
      });
      const refreshed = await api.get<RiskAssessmentDetail>(`/risk-assessments/${params.id}`);
      setData(refreshed);
      setAddingAction(false);
    } catch (err) {
      setAddActionError(err instanceof Error ? err.message : 'Failed to add treatment action');
    } finally {
      setAddActionSaving(false);
    }
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
                  <button type="button" onClick={openNewRiskModal} className="btn-secondary">
                    + New Risk
                  </button>
                </div>
              )}
            </div>
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
              <button type="button" onClick={openAddActionModal} className="btn-secondary">
                + Add Action
              </button>
            )}
          </div>
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

      {linkingOpen && (
        <Modal
          title="Link Risk from Register"
          subtitle="Vælg en eller flere eksisterende risici fra Risk Register, der skal knyttes til denne vurdering."
          onClose={() => setLinkingOpen(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setLinkingOpen(false)}>
                Annuller
              </button>
              <button type="button" className="btn-primary" onClick={saveLinks}>
                Link valgte risici ({selectedRiskIds.length})
              </button>
            </>
          }
        >
          <div className="modal-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <line x1="19" y1="19" x2="15.3" y2="15.3" />
            </svg>
            <input
              placeholder="Søg efter risiko-ID eller titel..."
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modal-list">
            {(allRisks ?? [])
              .filter((r) => {
                const q = linkSearch.trim().toLowerCase();
                if (!q) return true;
                return r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
              })
              .map((r) => {
                const checked = selectedRiskIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    className="modal-list-row"
                    onClick={() =>
                      setSelectedRiskIds((prev) => (checked ? prev.filter((id) => id !== r.id) : [...prev, r.id]))
                    }
                  >
                    <div className={`modal-checkbox${checked ? ' checked' : ''}`}>
                      {checked && (
                        <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="modal-row-id">{r.code}</span>
                    <span className="modal-row-title">{r.title}</span>
                    <BandBadge band={r.inherentBand} score={r.inherentScore} />
                  </div>
                );
              })}
            {allRisks && allRisks.length > 0 && !(allRisks ?? []).some((r) => {
              const q = linkSearch.trim().toLowerCase();
              if (!q) return true;
              return r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
            }) && <div className="modal-empty">No risks match your search.</div>}
          </div>
        </Modal>
      )}

      {newRiskOpen && (
        <Modal
          title="New Risk"
          subtitle="Create a new risk and link it to this assessment."
          onClose={() => setNewRiskOpen(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setNewRiskOpen(false)}>
                Cancel
              </button>
              <button type="submit" form="new-risk-modal-form" disabled={newRiskSaving} className="btn-primary">
                {newRiskSaving ? 'Creating…' : 'Create Risk'}
              </button>
            </>
          }
        >
          <form id="new-risk-modal-form" onSubmit={submitNewRisk}>
            <RiskFields
              values={newRiskValues}
              onChange={(key, value) => setNewRiskValues((prev) => ({ ...prev, [key]: value }))}
              categories={categories}
              orgUnits={orgUnits}
              users={users}
            />
            {newRiskError && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {newRiskError}
              </p>
            )}
          </form>
        </Modal>
      )}

      {addingAction && (
        <Modal
          title="Add Treatment Action"
          onClose={() => setAddingAction(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setAddingAction(false)}>
                Cancel
              </button>
              <button type="submit" form="add-action-modal-form" disabled={addActionSaving} className="btn-primary">
                {addActionSaving ? 'Adding…' : 'Add Action'}
              </button>
            </>
          }
        >
          <form id="add-action-modal-form" onSubmit={addTreatmentAction}>
            <div className="field">
              <label className="field-label">Description</label>
              <input
                required
                className="input"
                style={{ fontFamily: 'var(--font-chrome)' }}
                value={newActionDescription}
                onChange={(e) => setNewActionDescription(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Linked Risk</label>
              <select required className="select-input" value={newActionRiskId} onChange={(e) => setNewActionRiskId(e.target.value)}>
                <option value="">Select…</option>
                {assessment.linkedRisks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Owner</label>
              <select required className="select-input" value={newActionOwnerId} onChange={(e) => setNewActionOwnerId(e.target.value)}>
                <option value="">Select…</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Due Date</label>
              <input
                required
                type="date"
                className="input"
                style={{ fontFamily: 'var(--font-chrome)' }}
                value={newActionDueDate}
                onChange={(e) => setNewActionDueDate(e.target.value)}
              />
            </div>
            {addActionError && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {addActionError}
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
