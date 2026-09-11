'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { BandBadge } from '@/components/BandBadge';
import { Modal } from '@/components/Modal';
import { BusinessProcessFields, BusinessProcessFieldValues, CIA_SCALE_LABELS } from '@/components/bia/BusinessProcessFields';
import { BusinessProcessDetail, OrgUnit, PaginatedBusinessProcesses, PaginatedRisks, UserSummary } from '@/lib/types';
import { CRITICALITY_TIER_BADGE_CLASS, CRITICALITY_TIER_LABEL, RISK_STATUS_LABEL } from '@/lib/status-labels';

function toFieldValues(process: BusinessProcessDetail): BusinessProcessFieldValues {
  return {
    name: process.name,
    description: process.description ?? '',
    orgUnitId: process.orgUnitId,
    ownerId: process.ownerId,
    criticalityTier: process.criticalityTier,
    rtoMinutes: process.rtoMinutes ?? '',
    rpoMinutes: process.rpoMinutes ?? '',
    confidentialityScore: process.confidentialityScore ?? '',
    integrityScore: process.integrityScore ?? '',
    availabilityScore: process.availabilityScore ?? '',
  };
}

function toPayload(values: BusinessProcessFieldValues) {
  return {
    ...values,
    rtoMinutes: values.rtoMinutes === '' ? undefined : values.rtoMinutes,
    rpoMinutes: values.rpoMinutes === '' ? undefined : values.rpoMinutes,
    confidentialityScore: values.confidentialityScore === '' ? undefined : values.confidentialityScore,
    integrityScore: values.integrityScore === '' ? undefined : values.integrityScore,
    availabilityScore: values.availabilityScore === '' ? undefined : values.availabilityScore,
  };
}

export default function BusinessProcessDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const { data: process, loading, setData } = useApiGet<BusinessProcessDetail>(`/business-processes/${params.id}`, [params.id]);
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const { data: allRisksPage } = useApiGet<PaginatedRisks>('/risks?pageSize=0');
  const allRisks = allRisksPage?.items ?? null;
  const { data: allProcessesPage } = useApiGet<PaginatedBusinessProcesses>('/business-processes?pageSize=0');
  const allProcesses = (allProcessesPage?.items ?? null)?.filter((p) => p.id !== params.id) ?? null;

  const [values, setValues] = useState<BusinessProcessFieldValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkingOpen, setLinkingOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);

  const [dependencyLinkingOpen, setDependencyLinkingOpen] = useState(false);
  const [dependencySearch, setDependencySearch] = useState('');
  const [selectedDependsOnIds, setSelectedDependsOnIds] = useState<string[]>([]);

  const current = values ?? (process ? toFieldValues(process) : null);

  if (loading) return <p className="helper-note">Loading…</p>;
  if (!process || !current) return null;

  function onChange<K extends keyof BusinessProcessFieldValues>(key: K, value: BusinessProcessFieldValues[K]) {
    setValues({ ...current!, [key]: value });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<BusinessProcessDetail>(`/business-processes/${params.id}`, toPayload(current!));
      setData(updated);
      setValues(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save business process');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this business process? This also removes its risk links.')) return;
    setDeleting(true);
    try {
      await api.delete(`/business-processes/${params.id}`);
      router.push('/bia-register');
    } finally {
      setDeleting(false);
    }
  }

  function openLinkModal() {
    setSelectedRiskIds(process!.linkedRisks.map((r) => r.id));
    setLinkSearch('');
    setLinkingOpen(true);
  }

  async function saveLinks() {
    const updated = await api.put<BusinessProcessDetail>(`/business-processes/${params.id}/risks`, { riskIds: selectedRiskIds });
    setData(updated);
    setLinkingOpen(false);
  }

  function openDependencyLinkModal() {
    setSelectedDependsOnIds(process!.dependsOn.map((p) => p.id));
    setDependencySearch('');
    setDependencyLinkingOpen(true);
  }

  async function saveDependencyLinks() {
    const updated = await api.put<BusinessProcessDetail>(`/business-processes/${params.id}/dependencies`, {
      dependsOnIds: selectedDependsOnIds,
    });
    setData(updated);
    setDependencyLinkingOpen(false);
  }

  async function unlinkDependency(dependsOnId: string) {
    const updated = await api.put<BusinessProcessDetail>(`/business-processes/${params.id}/dependencies`, {
      dependsOnIds: process!.dependsOn.filter((p) => p.id !== dependsOnId).map((p) => p.id),
    });
    setData(updated);
  }

  async function unlinkRisk(riskId: string) {
    const updated = await api.put<BusinessProcessDetail>(`/business-processes/${params.id}/risks`, {
      riskIds: process!.linkedRisks.filter((r) => r.id !== riskId).map((r) => r.id),
    });
    setData(updated);
  }

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <Link href="/bia-register" className="crumb-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            BIA Register
          </Link>
          <span className="crumb-sep">|</span>
          <span className="crumb-id">{process.code}</span>
          <span className={`badge ${CRITICALITY_TIER_BADGE_CLASS[process.criticalityTier]}`}>{CRITICALITY_TIER_LABEL[process.criticalityTier]}</span>
        </div>
        {canEdit && (
          <div className="topbar-right">
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              Delete Process
            </button>
            <button type="submit" form="bia-detail-form" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="content two-col">
        <div className="col-left">
          <form id="bia-detail-form" onSubmit={handleSave} className="card">
            <div className="card-header">
              <div className="section-title">Business Process Details</div>
              <span className="created-note">Created {new Date(process.createdAt).toLocaleDateString()}</span>
            </div>
            <BusinessProcessFields values={current} onChange={onChange} orgUnits={orgUnits} users={users} disabled={!canEdit} />
            {error && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {error}
              </p>
            )}
          </form>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Audit History</div>
            </div>
            {process.auditHistory.length === 0 ? (
              <p className="helper-note">None yet.</p>
            ) : (
              process.auditHistory.map((entry) => (
                <div key={entry.id} className="linked-item">
                  <div>
                    <span style={{ fontFamily: 'var(--font-chrome)', fontSize: 12.5, color: 'var(--dgs-black)' }}>
                      {entry.actor?.name ?? 'System'} {entry.action.toLowerCase()}d the business process
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

        <div className="col-right">
          <div className="card">
            <div className="card-header">
              <div className="section-title">Recovery Objectives</div>
            </div>
            <div className="summary-row">
              <span className="summary-label">RTO</span>
              <span className="summary-value">{process.rtoMinutes != null ? `${process.rtoMinutes} min` : '—'}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">RPO</span>
              <span className="summary-value">{process.rpoMinutes != null ? `${process.rpoMinutes} min` : '—'}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Owner</span>
              <span className="summary-value">{process.owner.name}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Org Unit</span>
              <span className="summary-value">{process.orgUnit.name}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">CIA Rating</div>
            </div>
            <div className="score-tile-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="score-tile">
                <div className="score-tile-label">Confidentiality</div>
                <div className="score-tile-value">{process.confidentialityScore ?? '—'}</div>
                <div className="score-tile-sub">{process.confidentialityScore ? CIA_SCALE_LABELS[process.confidentialityScore] : 'Not set'}</div>
              </div>
              <div className="score-tile">
                <div className="score-tile-label">Integrity</div>
                <div className="score-tile-value">{process.integrityScore ?? '—'}</div>
                <div className="score-tile-sub">{process.integrityScore ? CIA_SCALE_LABELS[process.integrityScore] : 'Not set'}</div>
              </div>
              <div className="score-tile">
                <div className="score-tile-label">Availability</div>
                <div className="score-tile-value">{process.availabilityScore ?? '—'}</div>
                <div className="score-tile-sub">{process.availabilityScore ? CIA_SCALE_LABELS[process.availabilityScore] : 'Not set'}</div>
              </div>
            </div>
            <div className="helper-note" style={{ margin: 0 }}>Edit under Business Process Details on the left.</div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Dependencies</div>
              {canEdit && (
                <button type="button" onClick={openDependencyLinkModal} className="btn-secondary">
                  + Link Dependency
                </button>
              )}
            </div>
            {process.dependsOn.length === 0 ? (
              <p className="helper-note">Doesn&apos;t depend on any other business process yet.</p>
            ) : (
              process.dependsOn.map((p) => (
                <div key={p.id} className="linked-item">
                  <div>
                    <Link href={`/bia-register/${p.id}`} className="risk-title">
                      {p.code} — {p.name}
                    </Link>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${CRITICALITY_TIER_BADGE_CLASS[p.criticalityTier]}`}>{CRITICALITY_TIER_LABEL[p.criticalityTier]}</span>
                    {canEdit && (
                      <button type="button" className="link-btn" onClick={() => unlinkDependency(p.id)}>
                        Unlink
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            {process.dependents.length > 0 && (
              <>
                <div className="helper-note" style={{ marginTop: 14, marginBottom: 6 }}>
                  Depended on by (set from each process&apos;s own page):
                </div>
                {process.dependents.map((p) => (
                  <div key={p.id} className="linked-item">
                    <Link href={`/bia-register/${p.id}`} className="risk-title">
                      {p.code} — {p.name}
                    </Link>
                    <span className={`badge ${CRITICALITY_TIER_BADGE_CLASS[p.criticalityTier]}`}>{CRITICALITY_TIER_LABEL[p.criticalityTier]}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Threatening Risks</div>
              {canEdit && (
                <button type="button" onClick={openLinkModal} className="btn-secondary">
                  + Link from Register
                </button>
              )}
            </div>
            {process.linkedRisks.length === 0 ? (
              <p className="helper-note">No risks linked yet.</p>
            ) : (
              process.linkedRisks.map((r) => (
                <div key={r.id} className="linked-item">
                  <div>
                    <Link href={`/risk-register/${r.id}`} className="risk-title">
                      {r.code} — {r.title}
                    </Link>
                    <div className="helper-note" style={{ marginTop: 2 }}>
                      {r.category.name} · {RISK_STATUS_LABEL[r.status]}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BandBadge band={r.inherentBand} score={r.inherentScore} />
                    {canEdit && (
                      <button type="button" className="link-btn" onClick={() => unlinkRisk(r.id)}>
                        Unlink
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {linkingOpen && (
        <Modal
          title="Link Risk from Register"
          subtitle="Choose one or more existing risks from the Risk Register that threaten this business process."
          onClose={() => setLinkingOpen(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setLinkingOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={saveLinks}>
                Link Selected Risks ({selectedRiskIds.length})
              </button>
            </>
          }
        >
          <div className="modal-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <line x1="19" y1="19" x2="15.3" y2="15.3" />
            </svg>
            <input placeholder="Search by risk ID or title…" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} autoFocus />
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
                    onClick={() => setSelectedRiskIds((prev) => (checked ? prev.filter((id) => id !== r.id) : [...prev, r.id]))}
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
          </div>
        </Modal>
      )}

      {dependencyLinkingOpen && (
        <Modal
          title="Link Dependency"
          subtitle="Choose one or more other Business Processes that this one depends on to run."
          onClose={() => setDependencyLinkingOpen(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setDependencyLinkingOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={saveDependencyLinks}>
                Link Selected ({selectedDependsOnIds.length})
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
              placeholder="Search by process ID or name…"
              value={dependencySearch}
              onChange={(e) => setDependencySearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modal-list">
            {(allProcesses ?? [])
              .filter((p) => {
                const q = dependencySearch.trim().toLowerCase();
                if (!q) return true;
                return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
              })
              .map((p) => {
                const checked = selectedDependsOnIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className="modal-list-row"
                    onClick={() => setSelectedDependsOnIds((prev) => (checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]))}
                  >
                    <div className={`modal-checkbox${checked ? ' checked' : ''}`}>
                      {checked && (
                        <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="modal-row-id">{p.code}</span>
                    <span className="modal-row-title">{p.name}</span>
                    <span className={`badge ${CRITICALITY_TIER_BADGE_CLASS[p.criticalityTier]}`}>{CRITICALITY_TIER_LABEL[p.criticalityTier]}</span>
                  </div>
                );
              })}
            {allProcesses && allProcesses.length === 0 && <div className="modal-empty">No other business processes yet.</div>}
          </div>
        </Modal>
      )}
    </>
  );
}
