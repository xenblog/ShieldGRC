'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Category, OrgUnit, Risk, UserSummary } from '@/lib/types';
import { RiskFields, RiskFieldValues, emptyRiskFieldValues } from '@/components/risks/RiskFields';

function toPayload(values: RiskFieldValues) {
  return {
    ...values,
    treatmentStrategy: values.treatmentStrategy || undefined,
    nextReviewDate: values.nextReviewDate || undefined,
  };
}

export default function NewRiskPage() {
  const router = useRouter();
  const { data: categories } = useApiGet<Category[]>('/categories');
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');

  const [values, setValues] = useState<RiskFieldValues>(emptyRiskFieldValues());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChange<K extends keyof RiskFieldValues>(key: K, value: RiskFieldValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const risk = await api.post<Risk>('/risks', toPayload(values));
      router.push(`/risk-register/${risk.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create risk');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <button type="button" onClick={() => router.push('/risk-register')} className="crumb-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Risk Register
          </button>
          <span className="crumb-sep">|</span>
          <span className="crumb-id">New Risk</span>
        </div>
        <button type="submit" form="new-risk-form" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating…' : 'Create Risk'}
        </button>
      </div>

      <div className="content">
        <form id="new-risk-form" onSubmit={handleSubmit} className="card" style={{ maxWidth: 640 }}>
          <div className="card-header">
            <div className="section-title">Risk Details</div>
          </div>
          <RiskFields values={values} onChange={onChange} categories={categories} orgUnits={orgUnits} users={users} />
          {error && (
            <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
              {error}
            </p>
          )}
        </form>
      </div>
    </>
  );
}
