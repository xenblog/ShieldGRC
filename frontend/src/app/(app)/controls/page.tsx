'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Modal } from '@/components/Modal';
import { ControlFields, ControlFieldValues, emptyControlFieldValues } from '@/components/controls/ControlFields';
import { Category, Control, Framework, OrgUnit } from '@/lib/types';
import { CONTROL_EFFECTIVENESS_CLASS, CONTROL_EFFECTIVENESS_LABEL, CONTROL_FREQUENCY_LABEL, CONTROL_TYPE_LABEL } from '@/lib/status-labels';

const TYPES = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'COMPENSATING'] as const;
const EFFECTIVENESS_VALUES = ['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE', 'NOT_YET_TESTED'] as const;

function toPayload(values: ControlFieldValues) {
  return { ...values, nistCsfFunction: values.nistCsfFunction || undefined };
}

export default function ControlsPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const [search, setSearch] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [domainCategoryId, setDomainCategoryId] = useState('');
  const [type, setType] = useState('');
  const [effectiveness, setEffectiveness] = useState('');

  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: frameworks } = useApiGet<Framework[]>('/frameworks');

  const query = new URLSearchParams();
  if (orgUnitId) query.set('orgUnitId', orgUnitId);
  if (domainCategoryId) query.set('domainCategoryId', domainCategoryId);
  if (type) query.set('type', type);
  if (effectiveness) query.set('effectiveness', effectiveness);
  const queryStr = query.toString();
  const controlsPath = `/controls${queryStr ? `?${queryStr}` : ''}`;
  const { data: controls, loading, setData } = useApiGet<Control[]>(controlsPath, [controlsPath]);

  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<ControlFieldValues>(emptyControlFieldValues());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchLower = search.trim().toLowerCase();
  const filtered = (controls ?? []).filter(
    (c) => !searchLower || c.code.toLowerCase().includes(searchLower) || c.name.toLowerCase().includes(searchLower),
  );

  function openCreate() {
    setValues(emptyControlFieldValues());
    setError(null);
    setCreating(true);
  }

  function onChange<K extends keyof ControlFieldValues>(key: K, value: ControlFieldValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post<Control>('/controls', toPayload(values));
      const refreshed = await api.get<Control[]>(controlsPath);
      setData(refreshed);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create control');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Control Library</div>
        <div className="topbar-right">
          {canCreate && (
            <button type="button" onClick={openCreate} className="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Control
            </button>
          )}
        </div>
      </div>

      <div className="content">
        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="filter-bar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="19" y1="19" x2="15.3" y2="15.3" />
              </svg>
              <input placeholder="Search for a control…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="select">
              <option value="">Org unit: All</option>
              {orgUnits?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select value={domainCategoryId} onChange={(e) => setDomainCategoryId(e.target.value)} className="select">
              <option value="">Domain: All</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="select">
              <option value="">Type: All</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {CONTROL_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select value={effectiveness} onChange={(e) => setEffectiveness(e.target.value)} className="select">
              <option value="">Effectiveness: All</option>
              {EFFECTIVENESS_VALUES.map((v) => (
                <option key={v} value={v}>
                  {CONTROL_EFFECTIVENESS_LABEL[v]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <p className="helper-note" style={{ padding: 18 }}>
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="helper-note" style={{ padding: 18 }}>
              No controls match the current filters.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="grc-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Code</th>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Frequency</th>
                    <th>Frameworks</th>
                    <th>Effectiveness</th>
                    <th>Last Tested</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'var(--font-chrome)', color: 'var(--dgs-umami)' }}>
                        <Link href={`/controls/${c.id}`} className="risk-title">
                          {c.code}
                        </Link>
                      </td>
                      <td>{c.name}</td>
                      <td>
                        <span className="tag">{c.domainCategory?.name}</span>
                      </td>
                      <td>{CONTROL_TYPE_LABEL[c.type]}</td>
                      <td>{CONTROL_FREQUENCY_LABEL[c.frequency]}</td>
                      <td>
                        {c.frameworks.length === 0 ? (
                          <span className="helper-note" style={{ margin: 0 }}>
                            —
                          </span>
                        ) : (
                          c.frameworks.map((f) => (
                            <span key={f.id} className="tag" style={{ marginRight: 4 }}>
                              {f.name}
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        <span className={`status ${CONTROL_EFFECTIVENESS_CLASS[c.effectiveness]}`}>
                          {CONTROL_EFFECTIVENESS_LABEL[c.effectiveness]}
                        </span>
                      </td>
                      <td>{c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {creating && (
        <Modal
          title="New Control"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button type="submit" form="new-control-form" disabled={saving} className="btn-primary">
                {saving ? 'Creating…' : 'Create Control'}
              </button>
            </>
          }
        >
          <form id="new-control-form" onSubmit={submitCreate}>
            <ControlFields values={values} onChange={onChange} categories={categories} orgUnits={orgUnits} frameworks={frameworks} />
            {error && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
