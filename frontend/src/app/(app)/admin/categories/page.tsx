'use client';

import { useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Category } from '@/lib/types';

export default function CategoriesAdminPage() {
  const { data: categories, loading, setData } = useApiGet<Category[]>('/categories?includeInactive=true');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<Category>('/categories', {
        name,
        sortOrder: categories?.length ?? 0,
      });
      setData((prev) => [...(prev ?? []), created]);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  }

  async function toggleActive(category: Category) {
    const updated = await api.patch<Category>(`/categories/${category.id}`, { isActive: !category.isActive });
    setData((prev) => prev?.map((c) => (c.id === category.id ? updated : c)) ?? null);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Categories (primary taxonomy)</h1>
      <p className="text-sm text-[var(--dgs-text-muted)]">
        Used as the primary category on Risks and the &quot;Domain&quot; field on Controls.
      </p>

      <form onSubmit={handleCreate} className="dgs-card flex items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-[var(--dgs-text-muted)]">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-sm" />
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
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <button onClick={() => toggleActive(c)} className="text-xs text-[var(--dgs-primary)] hover:underline">
                      {c.isActive ? 'Deactivate' : 'Activate'}
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
