'use client';

import { useRouter } from 'next/navigation';
import { RiskForm, RiskFormValues, riskToFormValues } from '@/components/risks/RiskForm';
import { api } from '@/lib/api-client';
import { Risk } from '@/lib/types';

function toPayload(values: RiskFormValues) {
  return {
    ...values,
    nistCsfFunction: values.nistCsfFunction || undefined,
    treatmentStrategy: values.treatmentStrategy || undefined,
    residualLikelihood: values.residualLikelihood === '' ? undefined : values.residualLikelihood,
    residualImpact: values.residualImpact === '' ? undefined : values.residualImpact,
    nextReviewDate: values.nextReviewDate || undefined,
  };
}

export default function NewRiskPage() {
  const router = useRouter();

  async function handleSubmit(values: RiskFormValues) {
    const risk = await api.post<Risk>('/risks', toPayload(values));
    router.push(`/risk-register/${risk.id}`);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">New Risk</h1>
      <RiskForm initial={riskToFormValues()} onSubmit={handleSubmit} submitLabel="Create Risk" />
    </div>
  );
}
