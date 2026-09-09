'use client';

import { useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Category, OrgUnit } from '@/lib/types';

export default function SettingsAdminPage() {
  return (
    <>
      <div className="topbar">
        <div className="page-title">Settings</div>
      </div>
      <div className="content">
        <CategoriesEditor />
        <OrgUnitsEditor />
      </div>
    </>
  );
}

function ArchivedTag({ active }: { active: boolean }) {
  return (
    <span className="tag" style={active ? { color: 'var(--dgs-groent)', borderColor: '#cfdacb', background: '#eef1ec' } : undefined}>
      {active ? 'Active' : 'Archived'}
    </span>
  );
}

function CategoriesEditor() {
  const { data: categories, loading, setData } = useApiGet<Category[]>('/categories?includeInactive=true');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<Category>('/categories', { name, sortOrder: categories?.length ?? 0 });
      setData((prev) => (prev ? [...prev, created] : [created]));
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  }

  async function toggleActive(category: Category) {
    const updated = await api.patch<Category>(`/categories/${category.id}`, { isActive: !category.isActive });
    setData((prev) => prev?.map((c) => (c.id === category.id ? updated : c)) ?? null);
  }

  function startRename(category: Category) {
    setRenamingId(category.id);
    setRenameValue(category.name);
  }

  async function saveRename(category: Category) {
    const updated = await api.patch<Category>(`/categories/${category.id}`, { name: renameValue });
    setData((prev) => prev?.map((c) => (c.id === category.id ? updated : c)) ?? null);
    setRenamingId(null);
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="section-title">Categories</div>
      </div>
      <p className="helper-note" style={{ marginTop: -6, marginBottom: 14 }}>
        The primary risk taxonomy - used as the Category field on Risks and the Domain field on Controls.
      </p>

      <form onSubmit={handleCreate} className="field-row" style={{ alignItems: 'end', marginBottom: 16 }}>
        <input
          required
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          style={{ fontFamily: 'var(--font-chrome)', gridColumn: '1 / -1' }}
        />
        <button type="submit" className="btn-secondary">
          + Add Category
        </button>
      </form>
      {error && (
        <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="helper-note">Loading…</p>
      ) : (
        <table className="grc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 180 }}></th>
            </tr>
          </thead>
          <tbody>
            {categories?.map((c) => (
              <tr key={c.id}>
                <td>
                  {renamingId === c.id ? (
                    <input
                      autoFocus
                      className="input"
                      style={{ fontFamily: 'var(--font-chrome)' }}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td>
                  <ArchivedTag active={c.isActive} />
                </td>
                <td>
                  {renamingId === c.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="link-btn" onClick={() => saveRename(c)}>
                        Save
                      </button>
                      <button type="button" className="link-btn" onClick={() => setRenamingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="link-btn" onClick={() => startRename(c)}>
                        Rename
                      </button>
                      <button type="button" className="link-btn" onClick={() => toggleActive(c)}>
                        {c.isActive ? 'Archive' : 'Reactivate'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OrgUnitsEditor() {
  const { data: orgUnits, loading, setData } = useApiGet<OrgUnit[]>('/org-units');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<OrgUnit>('/org-units', { name, code: code || undefined });
      setData((prev) => (prev ? [...prev, created] : [created]));
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

  function startRename(orgUnit: OrgUnit) {
    setRenamingId(orgUnit.id);
    setRenameValue(orgUnit.name);
  }

  async function saveRename(orgUnit: OrgUnit) {
    const updated = await api.patch<OrgUnit>(`/org-units/${orgUnit.id}`, { name: renameValue });
    setData((prev) => prev?.map((o) => (o.id === orgUnit.id ? updated : o)) ?? null);
    setRenamingId(null);
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="section-title">Org Units</div>
      </div>
      <p className="helper-note" style={{ marginTop: -6, marginBottom: 14 }}>
        Organizational scoping used for RBAC and data visibility across every module.
      </p>

      <form onSubmit={handleCreate} className="field-row" style={{ alignItems: 'end', marginBottom: 16 }}>
        <input required placeholder="New org unit name" value={name} onChange={(e) => setName(e.target.value)} className="input" style={{ fontFamily: 'var(--font-chrome)' }} />
        <input placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} className="input" style={{ fontFamily: 'var(--font-chrome)' }} />
        <button type="submit" className="btn-secondary">
          + Add Org Unit
        </button>
      </form>
      {error && (
        <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="helper-note">Loading…</p>
      ) : (
        <table className="grc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 100 }}>Code</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 180 }}></th>
            </tr>
          </thead>
          <tbody>
            {orgUnits?.map((o) => (
              <tr key={o.id}>
                <td>
                  {renamingId === o.id ? (
                    <input
                      autoFocus
                      className="input"
                      style={{ fontFamily: 'var(--font-chrome)' }}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                  ) : (
                    o.name
                  )}
                </td>
                <td style={{ fontFamily: 'var(--font-chrome)', color: 'var(--dgs-umami)' }}>{o.code ?? '—'}</td>
                <td>
                  <ArchivedTag active={o.isActive} />
                </td>
                <td>
                  {renamingId === o.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="link-btn" onClick={() => saveRename(o)}>
                        Save
                      </button>
                      <button type="button" className="link-btn" onClick={() => setRenamingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="link-btn" onClick={() => startRename(o)}>
                        Rename
                      </button>
                      <button type="button" className="link-btn" onClick={() => toggleActive(o)}>
                        {o.isActive ? 'Archive' : 'Reactivate'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
