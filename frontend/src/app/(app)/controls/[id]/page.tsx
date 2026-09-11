'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api, saveBlob } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Modal } from '@/components/Modal';
import { ControlFields, ControlFieldValues } from '@/components/controls/ControlFields';
import { BandBadge } from '@/components/BandBadge';
import { Category, ControlDetail, FrameworkControl, OrgUnit, TestMethod, TestResult, UserSummary } from '@/lib/types';
import {
  CONTROL_EFFECTIVENESS_CLASS,
  CONTROL_EFFECTIVENESS_LABEL,
  CONTROL_FREQUENCY_LABEL,
  CONTROL_TYPE_LABEL,
  TEST_METHOD_LABEL,
  TEST_RESULT_CLASS,
  TEST_RESULT_LABEL,
} from '@/lib/status-labels';

const RESULTS: TestResult[] = ['PASS', 'PARTIAL', 'FAIL'];
const METHODS: TestMethod[] = ['INSPECTION', 'WALKTHROUGH', 'REPERFORMANCE', 'AUTOMATED'];

function toFieldValues(control: ControlDetail): ControlFieldValues {
  return {
    code: control.code,
    name: control.name,
    domainCategoryId: control.domainCategoryId,
    orgUnitId: control.orgUnitId,
    type: control.type,
    frequency: control.frequency,
    nistCsfFunction: control.nistCsfFunction ?? '',
    frameworkControlIds: control.frameworkControls.map((fc) => fc.id),
  };
}

function toPayload(values: ControlFieldValues) {
  return { ...values, nistCsfFunction: values.nistCsfFunction || undefined };
}

export default function ControlDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const { data: control, loading, setData } = useApiGet<ControlDetail>(`/controls/${params.id}`, [params.id]);
  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: frameworkControls } = useApiGet<FrameworkControl[]>('/framework-controls');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');

  const [values, setValues] = useState<ControlFieldValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingTest, setAddingTest] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>('PASS');
  const [testMethod, setTestMethod] = useState<TestMethod>('INSPECTION');
  const [testerId, setTesterId] = useState('');
  const [cycle, setCycle] = useState('');
  const [testedDate, setTestedDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [exceptionNotes, setExceptionNotes] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [testSaving, setTestSaving] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const current = values ?? (control ? toFieldValues(control) : null);

  if (loading) return <p className="helper-note">Loading…</p>;
  if (!control || !current) return null;

  function onChange<K extends keyof ControlFieldValues>(key: K, value: ControlFieldValues[K]) {
    setValues({ ...current!, [key]: value });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<ControlDetail>(`/controls/${params.id}`, toPayload(current!));
      setData(updated);
      setValues(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save control');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this control? This also removes its test history and unlinks it from any risks.')) return;
    setDeleting(true);
    try {
      await api.delete(`/controls/${params.id}`);
      router.push('/controls');
    } finally {
      setDeleting(false);
    }
  }

  function openAddTest() {
    setTestResult('PASS');
    setTestMethod('INSPECTION');
    setTesterId('');
    setCycle('');
    setTestedDate('');
    setDueDate('');
    setExceptionNotes('');
    setEvidenceFiles([]);
    setTestError(null);
    setAddingTest(true);
  }

  async function submitTest(e: React.FormEvent) {
    e.preventDefault();
    setTestSaving(true);
    setTestError(null);
    try {
      const form = new FormData();
      form.set('controlId', params.id);
      form.set('result', testResult);
      form.set('testMethod', testMethod);
      form.set('testerId', testerId);
      form.set('cycle', cycle);
      form.set('testedDate', testedDate);
      form.set('dueDate', dueDate);
      if (exceptionNotes) form.set('exceptionNotes', exceptionNotes);
      for (const file of evidenceFiles) form.append('evidence', file);

      await api.postForm('/control-tests', form);
      const refreshed = await api.get<ControlDetail>(`/controls/${params.id}`);
      setData(refreshed);
      setAddingTest(false);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to record test');
    } finally {
      setTestSaving(false);
    }
  }

  async function downloadEvidence(testId: string, evidenceId: string, filename: string) {
    const blob = await api.getBlob(`/control-tests/${testId}/evidence/${evidenceId}/download`);
    saveBlob(blob, filename);
  }

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <Link href="/controls" className="crumb-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Control Library
          </Link>
          <span className="crumb-sep">|</span>
          <span className="crumb-id">{control.code}</span>
          <span className={`status ${CONTROL_EFFECTIVENESS_CLASS[control.effectiveness]}`}>
            {CONTROL_EFFECTIVENESS_LABEL[control.effectiveness]}
          </span>
        </div>
        {canEdit && (
          <div className="topbar-right">
            <button onClick={handleDelete} disabled={deleting} className="btn-danger">
              Delete Control
            </button>
            <button type="submit" form="control-detail-form" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="content two-col">
        <div className="col-left">
          <form id="control-detail-form" onSubmit={handleSave} className="card">
            <div className="card-header">
              <div className="section-title">Control Details</div>
              <span className="created-note">Created {new Date(control.createdAt).toLocaleDateString()}</span>
            </div>
            <ControlFields values={current} onChange={onChange} categories={categories} orgUnits={orgUnits} frameworkControls={frameworkControls} disabled={!canEdit} />
            {error && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {error}
              </p>
            )}
          </form>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Test History</div>
              {canEdit && (
                <button type="button" onClick={openAddTest} className="btn-secondary">
                  + Add Test
                </button>
              )}
            </div>
            {control.tests.length === 0 ? (
              <p className="helper-note">No tests recorded yet.</p>
            ) : (
              <table className="grc-table">
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th>Result</th>
                    <th>Method</th>
                    <th>Tester</th>
                    <th>Tested</th>
                    <th>Next Due</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {control.tests.map((t) => (
                    <tr key={t.id}>
                      <td>{t.cycle}</td>
                      <td>
                        <span className={`status ${TEST_RESULT_CLASS[t.result]}`}>{TEST_RESULT_LABEL[t.result]}</span>
                      </td>
                      <td>{TEST_METHOD_LABEL[t.testMethod]}</td>
                      <td>{t.tester.name}</td>
                      <td>{new Date(t.testedDate).toLocaleDateString()}</td>
                      <td>
                        {new Date(t.dueDate).toLocaleDateString()}
                        {t.isOverdue && (
                          <span className="overdue" style={{ marginLeft: 6 }}>
                            Overdue
                          </span>
                        )}
                      </td>
                      <td>
                        {t.evidence.length === 0
                          ? '—'
                          : t.evidence.map((ev) => (
                              <button
                                key={ev.id}
                                type="button"
                                className="link-action"
                                style={{ display: 'block', textAlign: 'left' }}
                                onClick={() => downloadEvidence(t.id, ev.id, ev.filename)}
                              >
                                {ev.filename}
                              </button>
                            ))}
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
            {control.auditHistory.length === 0 ? (
              <p className="helper-note">None yet.</p>
            ) : (
              control.auditHistory.map((entry) => (
                <div key={entry.id} className="linked-item">
                  <div>
                    <span style={{ fontFamily: 'var(--font-chrome)', fontSize: 12.5, color: 'var(--dgs-black)' }}>
                      {entry.actor?.name ?? 'System'} {entry.action.toLowerCase()}d the control
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
              <div className="section-title">Summary</div>
            </div>
            <div className="summary-row">
              <span className="summary-label">Org Unit</span>
              <span className="summary-value">{control.orgUnit.name}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Type</span>
              <span className="summary-value">{CONTROL_TYPE_LABEL[control.type]}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Frequency</span>
              <span className="summary-value">{CONTROL_FREQUENCY_LABEL[control.frequency]}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Last Tested</span>
              <span className="summary-value">{control.lastTestedAt ? new Date(control.lastTestedAt).toLocaleDateString() : '—'}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title">Risks Mitigated</div>
              <span className="created-note">{control.linkedRisks.length} linked</span>
            </div>
            {control.linkedRisks.length === 0 ? (
              <p className="helper-note">Not linked to any risk yet — link it from the risk&apos;s detail page.</p>
            ) : (
              control.linkedRisks.map((r) => (
                <div key={r.id} className="linked-item">
                  <Link href={`/risk-register/${r.id}`} className="risk-title">
                    {r.code} — {r.title}
                  </Link>
                  <BandBadge band={r.inherentBand} score={r.inherentScore} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {addingTest && (
        <Modal
          title="Add Control Test"
          onClose={() => setAddingTest(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setAddingTest(false)}>
                Cancel
              </button>
              <button type="submit" form="add-test-form" disabled={testSaving} className="btn-primary">
                {testSaving ? 'Saving…' : 'Save Test'}
              </button>
            </>
          }
        >
          <form id="add-test-form" onSubmit={submitTest}>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Result</label>
                <select className="select-input" value={testResult} onChange={(e) => setTestResult(e.target.value as TestResult)}>
                  {RESULTS.map((r) => (
                    <option key={r} value={r}>
                      {TEST_RESULT_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Method</label>
                <select className="select-input" value={testMethod} onChange={(e) => setTestMethod(e.target.value as TestMethod)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {TEST_METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Tester</label>
                <select required className="select-input" value={testerId} onChange={(e) => setTesterId(e.target.value)}>
                  <option value="">Select…</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Cycle</label>
                <input required className="input" placeholder="e.g. Q3 2026" value={cycle} onChange={(e) => setCycle(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Tested Date</label>
                <input required type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={testedDate} onChange={(e) => setTestedDate(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Next Due Date</label>
                <input required type="date" className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            {(testResult === 'FAIL' || testResult === 'PARTIAL') && (
              <div className="field">
                <label className="field-label">Exception Notes (required for Fail/Partial)</label>
                <textarea required className="input" value={exceptionNotes} onChange={(e) => setExceptionNotes(e.target.value)} />
              </div>
            )}
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Evidence (optional)</label>
              <input type="file" multiple onChange={(e) => setEvidenceFiles(Array.from(e.target.files ?? []))} />
            </div>
            {testError && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {testError}
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
