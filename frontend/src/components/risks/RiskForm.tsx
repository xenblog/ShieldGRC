'use client';

import { useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { Category, NistCsfFunction, OrgUnit, Risk, RiskStatus, TreatmentStrategy, UserSummary } from '@/lib/types';

const STATUSES: RiskStatus[] = ['IDENTIFIED', 'ASSESSED', 'MITIGATING', 'ACCEPTED', 'CLOSED'];
const NIST_FUNCTIONS: NistCsfFunction[] = ['GOVERN', 'IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'];
const TREATMENT_STRATEGIES: TreatmentStrategy[] = ['AVOID', 'REDUCE', 'TRANSFER', 'ACCEPT'];
const SCALE = [1, 2, 3, 4, 5];

export interface RiskFormValues {
  title: string;
  description: string;
  categoryId: string;
  nistCsfFunction: NistCsfFunction | '';
  orgUnitId: string;
  ownerId: string;
  status: RiskStatus;
  likelihood: number;
  impact: number;
  treatmentStrategy: TreatmentStrategy | '';
  treatmentNote: string;
  residualLikelihood: number | '';
  residualImpact: number | '';
  notes: string;
  nextReviewDate: string;
}

export function riskToFormValues(risk?: Risk): RiskFormValues {
  return {
    title: risk?.title ?? '',
    description: risk?.description ?? '',
    categoryId: risk?.categoryId ?? '',
    nistCsfFunction: risk?.nistCsfFunction ?? '',
    orgUnitId: risk?.orgUnitId ?? '',
    ownerId: risk?.ownerId ?? '',
    status: risk?.status ?? 'IDENTIFIED',
    likelihood: risk?.likelihood ?? 3,
    impact: risk?.impact ?? 3,
    treatmentStrategy: risk?.treatmentStrategy ?? '',
    treatmentNote: risk?.treatmentNote ?? '',
    residualLikelihood: risk?.residualLikelihood ?? '',
    residualImpact: risk?.residualImpact ?? '',
    notes: risk?.notes ?? '',
    nextReviewDate: risk?.nextReviewDate ? risk.nextReviewDate.slice(0, 10) : '',
  };
}

export function RiskForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: RiskFormValues;
  onSubmit: (values: RiskFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');

  function set<K extends keyof RiskFormValues>(key: K, value: RiskFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save risk');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dgs-card space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Title"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          className="col-span-2 rounded border px-3 py-2 text-sm"
        />
        <textarea
          required
          placeholder="Description"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          className="col-span-2 rounded border px-3 py-2 text-sm"
        />

        <select required value={values.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Category…</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={values.nistCsfFunction}
          onChange={(e) => set('nistCsfFunction', e.target.value as NistCsfFunction | '')}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">NIST CSF tag (optional)…</option>
          {NIST_FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select required value={values.orgUnitId} onChange={(e) => set('orgUnitId', e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Org unit…</option>
          {orgUnits?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select required value={values.ownerId} onChange={(e) => set('ownerId', e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Owner…</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select value={values.status} onChange={(e) => set('status', e.target.value as RiskStatus)} className="rounded border px-3 py-2 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          required
          type="date"
          value={values.nextReviewDate}
          onChange={(e) => set('nextReviewDate', e.target.value)}
          title="Next review date"
          className="rounded border px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--dgs-border)' }}>
        <label className="text-xs text-[var(--dgs-text-muted)]">
          Likelihood (1-5)
          <select
            value={values.likelihood}
            onChange={(e) => set('likelihood', Number(e.target.value))}
            className="mt-1 block w-full rounded border px-3 py-2 text-sm"
          >
            {SCALE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--dgs-text-muted)]">
          Impact (1-5)
          <select
            value={values.impact}
            onChange={(e) => set('impact', Number(e.target.value))}
            className="mt-1 block w-full rounded border px-3 py-2 text-sm"
          >
            {SCALE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="col-span-2 text-xs text-[var(--dgs-text-muted)]">
          Inherent score = likelihood × impact, computed server-side and recalculated live on every save.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--dgs-border)' }}>
        <select
          value={values.treatmentStrategy}
          onChange={(e) => set('treatmentStrategy', e.target.value as TreatmentStrategy | '')}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">Treatment strategy (optional)…</option>
          {TREATMENT_STRATEGIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder="Treatment note"
          value={values.treatmentNote}
          onChange={(e) => set('treatmentNote', e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
        <label className="text-xs text-[var(--dgs-text-muted)]">
          Residual likelihood (after treatment)
          <select
            value={values.residualLikelihood}
            onChange={(e) => set('residualLikelihood', e.target.value === '' ? '' : Number(e.target.value))}
            className="mt-1 block w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {SCALE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--dgs-text-muted)]">
          Residual impact (after treatment)
          <select
            value={values.residualImpact}
            onChange={(e) => set('residualImpact', e.target.value === '' ? '' : Number(e.target.value))}
            className="mt-1 block w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {SCALE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        placeholder="Notes"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
        rows={2}
        className="w-full rounded border px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-[var(--dgs-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--dgs-primary-hover)] disabled:opacity-60"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
