'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApiGet } from '@/lib/hooks';
import { api, apiDownload } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Control, ControlTest, TestMethod, TestResult, UserSummary } from '@/lib/types';

const RESULTS: TestResult[] = ['PASS', 'FAIL', 'PARTIAL'];
const METHODS: TestMethod[] = ['INSPECTION', 'WALKTHROUGH', 'REPERFORMANCE', 'AUTOMATED'];

const RESULT_COLOR: Record<TestResult, string> = {
  PASS: 'text-green-700 bg-green-50',
  PARTIAL: 'text-amber-700 bg-amber-50',
  FAIL: 'text-red-700 bg-red-50',
};

export default function ControlTestingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
      <ControlTestingPageInner />
    </Suspense>
  );
}

function ControlTestingPageInner() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';
  const searchParams = useSearchParams();
  const preselectedControlId = searchParams.get('controlId') ?? '';

  const [result, setResult] = useState('');
  const [testerId, setTesterId] = useState('');
  const [cycle, setCycle] = useState('');
  const [showNew, setShowNew] = useState(Boolean(preselectedControlId));

  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const { data: controls } = useApiGet<Control[]>('/controls');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (result) params.set('result', result);
    if (testerId) params.set('testerId', testerId);
    if (cycle) params.set('cycle', cycle);
    return params.toString();
  }, [result, testerId, cycle]);

  const path = `/control-tests${query ? `?${query}` : ''}`;
  const { data: tests, loading, setData } = useApiGet<ControlTest[]>(path, [path]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Control Testing</h1>
        {canCreate && !showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
          >
            Record test
          </button>
        )}
      </div>

      {showNew && controls && users && (
        <NewTestForm
          controls={controls}
          users={users}
          defaultControlId={preselectedControlId}
          onCancel={() => setShowNew(false)}
          onCreated={(test) => {
            setData((prev) => (prev ? [test, ...prev] : [test]));
            setShowNew(false);
          }}
        />
      )}

      <div className="dgs-card flex flex-wrap gap-3 p-3">
        <select value={result} onChange={(e) => setResult(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All results</option>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={testerId} onChange={(e) => setTesterId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All testers</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Cycle (e.g. Q3 2026)"
          value={cycle}
          onChange={(e) => setCycle(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        />
      </div>

      <div className="dgs-card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Control</th>
                <th>Cycle</th>
                <th>Result</th>
                <th>Method</th>
                <th>Tester</th>
                <th>Tested date</th>
                <th>Due date</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {tests?.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/controls/${t.controlId}`} className="hover:underline">
                      {t.control?.code}
                    </Link>
                  </td>
                  <td>{t.cycle}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${RESULT_COLOR[t.result]}`}>{t.result}</span>
                  </td>
                  <td>{t.testMethod}</td>
                  <td>{t.tester.name}</td>
                  <td>{new Date(t.testedDate).toLocaleDateString()}</td>
                  <td className={t.isOverdue ? 'font-semibold text-red-600' : t.isDueSoon ? 'font-semibold text-amber-600' : ''}>
                    {new Date(t.dueDate).toLocaleDateString()}
                    {t.isOverdue && ' (overdue)'}
                    {!t.isOverdue && t.isDueSoon && ' (due soon)'}
                  </td>
                  <td>
                    {t.evidence.length === 0 ? (
                      '—'
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {t.evidence.map((ev) => (
                          <button
                            key={ev.id}
                            onClick={() => apiDownload(`/control-tests/${t.id}/evidence/${ev.id}/download`, ev.filename)}
                            className="text-left text-xs text-[var(--dgs-primary)] hover:underline"
                          >
                            {ev.filename}
                          </button>
                        ))}
                      </div>
                    )}
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

function NewTestForm({
  controls,
  users,
  defaultControlId,
  onCancel,
  onCreated,
}: {
  controls: Control[];
  users: UserSummary[];
  defaultControlId: string;
  onCancel: () => void;
  onCreated: (test: ControlTest) => void;
}) {
  const [controlId, setControlId] = useState(defaultControlId);
  const [result, setResult] = useState<TestResult>('PASS');
  const [testMethod, setTestMethod] = useState<TestMethod>('INSPECTION');
  const [testerId, setTesterId] = useState('');
  const [cycle, setCycle] = useState('');
  const [testedDate, setTestedDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [exceptionNotes, setExceptionNotes] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiresNotes = result === 'FAIL' || result === 'PARTIAL';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('controlId', controlId);
      form.set('result', result);
      form.set('testMethod', testMethod);
      form.set('testerId', testerId);
      form.set('cycle', cycle);
      form.set('testedDate', testedDate);
      form.set('dueDate', dueDate);
      if (exceptionNotes) form.set('exceptionNotes', exceptionNotes);
      if (files) {
        Array.from(files).forEach((f) => form.append('evidence', f));
      }
      const created = await api.postForm<ControlTest>('/control-tests', form);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record test');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dgs-card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <select required value={controlId} onChange={(e) => setControlId(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Control…</option>
          {controls.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
        <select
          required
          value={testerId}
          onChange={(e) => setTesterId(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">Tester…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select value={result} onChange={(e) => setResult(e.target.value as TestResult)} className="rounded border px-3 py-2 text-sm">
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={testMethod} onChange={(e) => setTestMethod(e.target.value as TestMethod)} className="rounded border px-3 py-2 text-sm">
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input required placeholder="Cycle (e.g. Q3 2026)" value={cycle} onChange={(e) => setCycle(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <div />
        <div>
          <label className="mb-1 block text-xs text-[var(--dgs-text-muted)]">Tested date</label>
          <input required type="date" value={testedDate} onChange={(e) => setTestedDate(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--dgs-text-muted)]">Next due date</label>
          <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--dgs-text-muted)]">
          Exception notes {requiresNotes && <span className="text-red-600">(required for Fail/Partial)</span>}
        </label>
        <textarea
          required={requiresNotes}
          value={exceptionNotes}
          onChange={(e) => setExceptionNotes(e.target.value)}
          rows={2}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--dgs-text-muted)]">
          Evidence (PDF, Word, Excel, CSV, image, text - max 25MB each)
        </label>
        <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="text-sm" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--dgs-primary-hover)]">
          {submitting ? 'Saving…' : 'Save test'}
        </button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
