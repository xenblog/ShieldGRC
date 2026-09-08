import { TreatmentActionStatus } from '@prisma/client';

/**
 * Shared "is this overdue" checks so every place that renders a Risk or a
 * TreatmentAction (its own module's responses, but also anywhere one is
 * embedded in a larger response like a RiskAssessment detail) computes the
 * same `isOverdue` flag the same way, instead of each call site
 * reimplementing (and potentially drifting from) the rule.
 */

export function withRiskOverdueFlag<T extends { nextReviewDate: Date | null }>(risk: T) {
  return {
    ...risk,
    isOverdue: Boolean(risk.nextReviewDate && risk.nextReviewDate.getTime() < Date.now()),
  };
}

export function withTreatmentActionOverdueFlag<T extends { dueDate: Date; status: TreatmentActionStatus }>(
  action: T,
) {
  return {
    ...action,
    isOverdue: action.status !== TreatmentActionStatus.COMPLETED && action.dueDate.getTime() < Date.now(),
  };
}
