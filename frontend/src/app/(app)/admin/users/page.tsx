'use client';

import { useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { OrgUnit, UserRole } from '@/lib/types';

const ROLES: UserRole[] = ['ADMIN', 'RISK_OWNER', 'AUDITOR', 'EXECUTIVE'];

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  orgUnits: OrgUnit[];
}

export default function UsersAdminPage() {
  const { data: users, loading, setData } = useApiGet<AdminUser[]>('/users');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const [showNew, setShowNew] = useState(false);

  async function deactivate(id: string) {
    const updated = await api.post<AdminUser>(`/users/${id}/deactivate`);
    setData((prev) => prev?.map((u) => (u.id === id ? updated : u)) ?? null);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
        >
          New user
        </button>
      </div>

      {showNew && orgUnits && (
        <NewUserForm
          orgUnits={orgUnits}
          onCancel={() => setShowNew(false)}
          onCreated={(u) => {
            setData((prev) => [...(prev ?? []), u]);
            setShowNew(false);
          }}
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
                <th>Email</th>
                <th>Role</th>
                <th>Org units</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.orgUnits.map((o) => o.name).join(', ') || '—'}</td>
                  <td>{u.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    {u.isActive && (
                      <button onClick={() => deactivate(u.id)} className="text-xs text-red-600 hover:underline">
                        Deactivate
                      </button>
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

function NewUserForm({
  orgUnits,
  onCancel,
  onCreated,
}: {
  orgUnits: OrgUnit[];
  onCancel: () => void;
  onCreated: (user: AdminUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('RISK_OWNER');
  const [password, setPassword] = useState('');
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<AdminUser>('/users', {
        email,
        name,
        role,
        password: password || undefined,
        orgUnitIds,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dgs-card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="rounded border px-3 py-2 text-sm">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          type="password"
          placeholder="Local password (optional, for SSO-only leave blank)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <p className="mb-1 text-xs text-[var(--dgs-text-muted)]">Org unit membership</p>
        <div className="flex flex-wrap gap-3">
          {orgUnits.map((o) => (
            <label key={o.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={orgUnitIds.includes(o.id)}
                onChange={(e) =>
                  setOrgUnitIds((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id)))
                }
              />
              {o.name}
            </label>
          ))}
        </div>
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
