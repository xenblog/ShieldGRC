'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { OrgUnit, RiskAssessment, UserSummary } from '@/lib/types';

export default function AssessmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';
  const { data: assessments, loading } = useApiGet<RiskAssessment[]>('/risk-assessments');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Risk Assessments</h1>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
          >
            New Assessment
          </button>
        )}
      </div>

      {showNew && orgUnits && users && (
        <NewAssessmentForm
          orgUnits={orgUnits}
          users={users}
          onCancel={() => setShowNew(false)}
          onCreated={(id) => router.push(`/risk-assessment/assessments/${id}`)}
        />
      )}

      <div className="dgs-card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Org Unit</th>
                <th>Lead assessor</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {assessments?.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/risk-assessment/assessments/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  <td>{a.orgUnit?.name}</td>
                  <td>{a.leadAssessor?.name}</td>
                  <td>{a.status}</td>
                  <td>{a.progressPercent}%</td>
                  <td>{new Date(a.dueDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
      const created = await api.post<RiskAssessment>('/risk-assessments', {
        name,
        scope,
        orgUnitId,
        leadAssessorId,
        startDate,
        dueDate,
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dgs-card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Assessment name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="col-span-2 rounded border px-3 py-2 text-sm"
        />
        <textarea
          required
          placeholder="Scope - what's being assessed and why"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="col-span-2 rounded border px-3 py-2 text-sm"
          rows={2}
        />
        <select required value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Org unit…</option>
          {orgUnits.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          required
          value={leadAssessorId}
          onChange={(e) => setLeadAssessorId(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">Lead assessor…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
