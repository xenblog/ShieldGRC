'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Category,
  Control,
  ControlEffectiveness,
  ControlFrequency,
  ControlType,
  Framework,
  OrgUnit,
} from '@/lib/types';

const TYPES: ControlType[] = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'COMPENSATING'];
const FREQUENCIES: ControlFrequency[] = ['CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
const EFFECTIVENESS: ControlEffectiveness[] = ['EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE', 'NOT_YET_TESTED'];

const EFFECTIVENESS_COLOR: Record<ControlEffectiveness, string> = {
  EFFECTIVE: 'text-green-700 bg-green-50',
  PARTIALLY_EFFECTIVE: 'text-amber-700 bg-amber-50',
  INEFFECTIVE: 'text-red-700 bg-red-50',
  NOT_YET_TESTED: 'text-gray-600 bg-gray-100',
};

export default function ControlsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RISK_OWNER';

  const [domainCategoryId, setDomainCategoryId] = useState('');
  const [type, setType] = useState('');
  const [frameworkId, setFrameworkId] = useState('');
  const [effectiveness, setEffectiveness] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: frameworks } = useApiGet<Framework[]>('/frameworks');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (domainCategoryId) params.set('domainCategoryId', domainCategoryId);
    if (type) params.set('type', type);
    if (frameworkId) params.set('frameworkId', frameworkId);
    if (effectiveness) params.set('effectiveness', effectiveness);
    return params.toString();
  }, [domainCategoryId, type, frameworkId, effectiveness]);

  const path = `/controls${query ? `?${query}` : ''}`;
  const { data: controls, loading } = useApiGet<Control[]>(path, [path]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Control Library</h1>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)]"
          >
            New Control
          </button>
        )}
      </div>

      {showNew && categories && orgUnits && frameworks && (
        <NewControlForm
          categories={categories}
          orgUnits={orgUnits}
          frameworks={frameworks}
          onCancel={() => setShowNew(false)}
          onCreated={(id) => router.push(`/controls/${id}`)}
        />
      )}

      <div className="dgs-card flex flex-wrap gap-3 p-3">
        <select value={domainCategoryId} onChange={(e) => setDomainCategoryId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All domains</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All frameworks</option>
          {frameworks?.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select value={effectiveness} onChange={(e) => setEffectiveness(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="">All effectiveness</option>
          {EFFECTIVENESS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="dgs-card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="dgs-table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Domain</th>
                <th>Type</th>
                <th>Frequency</th>
                <th>Effectiveness</th>
                <th>Last tested</th>
              </tr>
            </thead>
            <tbody>
              {controls?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/controls/${c.id}`} className="hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td>{c.name}</td>
                  <td>{c.domainCategory?.name}</td>
                  <td>{c.type}</td>
                  <td>{c.frequency}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${EFFECTIVENESS_COLOR[c.effectiveness]}`}>
                      {c.effectiveness}
                    </span>
                  </td>
                  <td>{c.lastTestedAt ? new Date(c.lastTestedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewControlForm({
  categories,
  orgUnits,
  frameworks,
  onCancel,
  onCreated,
}: {
  categories: Category[];
  orgUnits: OrgUnit[];
  frameworks: Framework[];
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [domainCategoryId, setDomainCategoryId] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [type, setType] = useState<ControlType>('PREVENTIVE');
  const [frequency, setFrequency] = useState<ControlFrequency>('QUARTERLY');
  const [frameworkIds, setFrameworkIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<Control>('/controls', {
        code,
        name,
        domainCategoryId,
        orgUnitId,
        type,
        frequency,
        frameworkIds,
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create control');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dgs-card space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="Code (e.g. CTL-019)" value={code} onChange={(e) => setCode(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        <select required value={domainCategoryId} onChange={(e) => setDomainCategoryId(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Domain…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select required value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Org unit…</option>
          {orgUnits.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as ControlType)} className="rounded border px-3 py-2 text-sm">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as ControlFrequency)} className="rounded border px-3 py-2 text-sm">
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--dgs-text-muted)]">Framework mapping</p>
        <div className="flex flex-wrap gap-3">
          {frameworks.map((f) => (
            <label key={f.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={frameworkIds.includes(f.id)}
                onChange={(e) =>
                  setFrameworkIds((prev) => (e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)))
                }
              />
              {f.name}
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
