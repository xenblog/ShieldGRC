'use client';

import { useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { OrgUnit } from '@/lib/types';

export default function OrgUnitsAdminPage() {
  const { data: orgUnits, loading, setData } = useApiGet<OrgUnit[]>('/org-units');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<OrgUnit>('/org-units', { name, code: code || undefined });
      setData((prev) => [...(prev ?? []), created]);
      setName('');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create org unit');
    }
  }

  async function toggleActive(orgUnit: OrgUnit) {
    const updated = await api.patch<OrgUnit>(`/org-units/${orgUnit.id}`, { isActive: !orgUnit.isActive });
    setData((prev) => prev?.map((o) => (o.id === orgUnit.id ? updated : o)) ?? null);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Org Units</h1>

      <form onSubmit={handleCreate} className="dgs-card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-[var(--dgs-text-muted)]">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--dgs-text-muted)]">Code (optional)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded bg-[var(--dgs-primary)] px-3 py-2 text-sm text-white hover:bg-[var(--dgs-primary-hover)]">
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="dgs-card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orgUnits?.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>{o.code ?? '—'}</td>
                  <td>{o.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <button onClick={() => toggleActive(o)} className="text-xs text-[var(--dgs-primary)] hover:underline">
                      {o.isActive ? 'Deactivate' : 'Activate'}
                    </button>
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
