'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { OrgUnit, RiskAssessment, TreatmentAction, UserSummary, MethodologyVersion, AssessmentStatus } from '@/lib/types';
import { ASSESSMENT_STATUS_CLASS, ASSESSMENT_STATUS_LABEL, TREATMENT_STATUS_CLASS, TREATMENT_STATUS_LABEL } from '@/lib/status-labels';

const STATUSES: AssessmentStatus[] = ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'];

export default function AssessmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';
  const { data: assessments, loading } = useApiGet<RiskAssessment[]>('/risk-assessments');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const { data: treatmentActions } = useApiGet<TreatmentAction[]>('/treatment-actions');
  const { data: methodology } = useApiGet<MethodologyVersion>('/methodology/current');
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [leadAssessorId, setLeadAssessorId] = useState('');

  const searchLower = search.trim().toLowerCase();
  const filtered = (assessments ?? []).filter((a) => {
    if (status && a.status !== status) return false;
    if (leadAssessorId && a.leadAssessorId !== leadAssessorId) return false;
    if (searchLower && !a.name.toLowerCase().includes(searchLower) && !a.code.toLowerCase().includes(searchLower)) return false;
    return true;
  });

  const counts = useMemo(() => {
    const all = assessments ?? [];
    return {
      inProgress: all.filter((a) => a.status === 'IN_PROGRESS').length,
      underReview: all.filter((a) => a.status === 'UNDER_REVIEW').length,
      completed: all.filter((a) => a.status === 'COMPLETED').length,
      total: all.length,
    };
  }, [assessments]);

  return (
    <>
      <div className="topbar">
        <div className="page-title">Risk Assessment</div>
      </div>

      <div className="content">
        <div className="kpi-chip-row">
          <div className="kpi-chip accent-progress">
            <div className="kpi-num">{counts.inProgress}</div>
            <div className="kpi-chip-label">In Progress</div>
          </div>
          <div className="kpi-chip accent-review">
            <div className="kpi-num">{counts.underReview}</div>
            <div className="kpi-chip-label">Under Review</div>
          </div>
          <div className="kpi-chip accent-complete">
            <div className="kpi-num">{counts.completed}</div>
            <div className="kpi-chip-label">Completed</div>
          </div>
          <div className="kpi-chip">
            <div className="kpi-num">{counts.total}</div>
            <div className="kpi-chip-label">Total Assessments</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="filter-bar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="19" y1="19" x2="15.3" y2="15.3" />
              </svg>
              <input placeholder="Search for an assessment…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="select">
              <option value="">Status: All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ASSESSMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select value={leadAssessorId} onChange={(e) => setLeadAssessorId(e.target.value)} className="select">
              <option value="">Lead Assessor: All</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {canCreate && (
              <button onClick={() => setShowNew(true)} className="btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Assessment
              </button>
            )}
          </div>
        </div>

        {showNew && orgUnits && users && (
          <NewAssessmentForm
            orgUnits={orgUnits}
            users={users}
            onCancel={() => setShowNew(false)}
            onCreated={(id) => router.push(`/risk-assessment/assessments/${id}`)}
          />
        )}

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <p className="helper-note" style={{ padding: 18 }}>
              Loading…
            </p>
          ) : (
            <table className="grc-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>ID</th>
                  <th style={{ width: '22%' }}>Assessment Name</th>
                  <th>Scope</th>
                  <th>Lead Assessor</th>
                  <th>Start Date</th>
                  <th>Due Date</th>
                  <th style={{ width: 130 }}>Progress</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'var(--font-chrome)', color: 'var(--dgs-umami)' }}>{a.code}</td>
                    <td className="risk-title">
                      {a.name}
                      {a.isOverdue && (
                        <span className="overdue" style={{ display: 'inline-flex', marginLeft: 6 }}>
                          Overdue
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="tag">{a.scope}</span>
                    </td>
                    <td>
                      <div className="owner-cell">{a.leadAssessor.name}</div>
                    </td>
                    <td>{new Date(a.startDate).toLocaleDateString()}</td>
                    <td>{new Date(a.dueDate).toLocaleDateString()}</td>
                    <td className="progress-cell">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${a.progressPercent}%` }} />
                      </div>
                      {a.progressPercent}%
                    </td>
                    <td>
                      <span className={`status ${ASSESSMENT_STATUS_CLASS[a.status]}`}>{ASSESSMENT_STATUS_LABEL[a.status]}</span>
                    </td>
                    <td>
                      <Link href={`/risk-assessment/assessments/${a.id}`} className="btn-secondary">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="helper-note" style={{ padding: 18 }}>
                      No assessments match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="two-col">
          <div className="card">
            <div className="section-title">
              Treatment Actions
              <Link href="/risk-assessment/treatment-actions" className="section-title-link">
                View all →
              </Link>
            </div>
            <table className="grc-table">
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Action Description</th>
                  <th>Linked Risk</th>
                  <th>Owner</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {treatmentActions?.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td className="risk-title">{t.description}</td>
                    <td>
                      <span className="tag">{t.risk.code}</span>
                    </td>
                    <td>
                      <div className="owner-cell">{t.owner.name}</div>
                    </td>
                    <td>{new Date(t.dueDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`status ${TREATMENT_STATUS_CLASS[t.status]}`}>{TREATMENT_STATUS_LABEL[t.status]}</span>
                    </td>
                  </tr>
                ))}
                {treatmentActions?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="helper-note" style={{ padding: 18 }}>
                      None yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="section-title">
              Assessment Methodology
              <Link href="/risk-assessment/methodology" className="section-title-link">
                Full page →
              </Link>
            </div>
            {methodology && (
              <>
                <span className="std-badge">
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  {methodology.frameworkReference}
                </span>
                <div style={{ marginTop: 14 }}>
                  <div className="methodology-row">
                    <span className="methodology-label">Scoring</span>
                    <span className="methodology-value">Likelihood (1–5) × Impact (1–5)</span>
                  </div>
                  <div className="methodology-row">
                    <span className="methodology-label">Low</span>
                    <span className="methodology-value">Score &lt; 4</span>
                  </div>
                  <div className="methodology-row">
                    <span className="methodology-label">Medium</span>
                    <span className="methodology-value">Score 4–7</span>
                  </div>
                  <div className="methodology-row">
                    <span className="methodology-label">High</span>
                    <span className="methodology-value">Score 8–14</span>
                  </div>
                  <div className="methodology-row">
                    <span className="methodology-label">Critical</span>
                    <span className="methodology-value">Score ≥ 15</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function NewAssessmentForm({
  orgUnits,
  users,
  onCancel,
  onCreated,
}: {
  orgUnits: OrgUnit[];
  users: UserSummary[];
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [leadAssessorId, setLeadAssessorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<RiskAssessment>('/risk-assessments', { name, scope, orgUnitId, leadAssessorId, startDate, dueDate });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-header">
        <div className="section-title">New Assessment</div>
      </div>
      <div className="field">
        <label className="field-label">Assessment Name</label>
        <input required className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="field-label">Scope</label>
        <input
          required
          className="input"
          style={{ fontFamily: 'var(--font-chrome)' }}
          placeholder="What's being assessed and why"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Org Unit</label>
          <select required className="select-input" value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
            <option value="">Select…</option>
            {orgUnits.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Lead Assessor</label>
          <select required className="select-input" value={leadAssessorId} onChange={(e) => setLeadAssessorId(e.target.value)}>
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Start Date</label>
          <input required type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Due Date</label>
          <input required type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      {error && (
        <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
