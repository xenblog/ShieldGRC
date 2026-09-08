'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Framework, OrgUnit, UserSummary } from '@/lib/types';

export default function CompliancePage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';
  const { data: frameworks, loading } = useApiGet<Framework[]>('/frameworks');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Compliance Frameworks</h1>
        {isAdmin && (
          <button
            onClick={() => setShowNew(true)}
            className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
          >
            New Framework
          </button>
        )}
      </div>

      {showNew && orgUnits && users && (
        <NewFrameworkForm
          orgUnits={orgUnits}
          users={users}
          onCancel={() => setShowNew(false)}
          onCreated={(id) => router.push(`/compliance/${id}`)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {frameworks?.map((f) => (
          <Link key={f.id} href={`/compliance/${f.id}`} className="dgs-card block p-4 hover:shadow-sm">
            <p className="font-medium">{f.name}</p>
            <p className="mt-1 text-xs text-[var(--dgs-text-muted)] line-clamp-2">{f.description}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-[var(--dgs-primary)]"
                style={{ width: `${f.coveragePercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--dgs-text-muted)]">
              {f.coveragePercent}% coverage · {f.mappedControlCount} controls mapped
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewFrameworkForm({
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
  const [description, setDescription] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<Framework>('/frameworks', { name, description, orgUnitId, ownerId });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create framework');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dgs-card space-y-3 p-4">
      <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
      <textarea
        required
        placeholder="Description / scope"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full rounded border px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <select required value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Org unit…</option>
          {orgUnits.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select required value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Owner…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--dgs-primary-hover)]">
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
