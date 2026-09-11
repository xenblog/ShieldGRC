'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { BusinessProcess, OrgUnit, UserSummary } from '@/lib/types';
import { BusinessProcessFields, BusinessProcessFieldValues, emptyBusinessProcessFieldValues } from '@/components/bia/BusinessProcessFields';

function toPayload(values: BusinessProcessFieldValues) {
  return {
    ...values,
    rtoMinutes: values.rtoMinutes === '' ? undefined : values.rtoMinutes,
    rpoMinutes: values.rpoMinutes === '' ? undefined : values.rpoMinutes,
  };
}

export default function NewBusinessProcessPage() {
  const router = useRouter();
  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');
  const { data: users } = useApiGet<UserSummary[]>('/users/assignable');

  const [values, setValues] = useState<BusinessProcessFieldValues>(emptyBusinessProcessFieldValues());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChange<K extends keyof BusinessProcessFieldValues>(key: K, value: BusinessProcessFieldValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const process = await api.post<BusinessProcess>('/business-processes', toPayload(values));
      router.push(`/bia-register/${process.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business process');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <button type="button" onClick={() => router.push('/bia-register')} className="crumb-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            BIA Register
          </button>
          <span className="crumb-sep">|</span>
          <span className="crumb-id">New Business Process</span>
        </div>
        <button type="submit" form="new-bia-form" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating…' : 'Create Business Process'}
        </button>
      </div>

      <div className="content">
        <form id="new-bia-form" onSubmit={handleSubmit} className="card" style={{ maxWidth: 640 }}>
          <div className="card-header">
            <div className="section-title">Business Process Details</div>
          </div>
          <BusinessProcessFields values={values} onChange={onChange} orgUnits={orgUnits} users={users} />
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
