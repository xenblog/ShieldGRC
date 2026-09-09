import { AssessmentStatus, RiskStatus, TreatmentActionStatus } from './types';

/** Humanized label + `.status-*` CSS class suffix for every status enum used in the UI. */

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  IDENTIFIED: 'Identified',
  ASSESSED: 'Assessed',
  MITIGATING: 'Mitigating',
  ACCEPTED: 'Accepted',
  CLOSED: 'Closed',
};
export const RISK_STATUS_CLASS: Record<RiskStatus, string> = {
  IDENTIFIED: 'status-identified',
  ASSESSED: 'status-assessed',
  MITIGATING: 'status-mitigating',
  ACCEPTED: 'status-accepted',
  CLOSED: 'status-closed',
};

export const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  UNDER_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
};
export const ASSESSMENT_STATUS_CLASS: Record<AssessmentStatus, string> = {
  PLANNED: 'status-planned',
  IN_PROGRESS: 'status-in-progress',
  UNDER_REVIEW: 'status-under-review',
  COMPLETED: 'status-completed',
};

export const TREATMENT_STATUS_LABEL: Record<TreatmentActionStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  OVERDUE: 'Overdue',
};
export const TREATMENT_STATUS_CLASS: Record<TreatmentActionStatus, string> = {
  NOT_STARTED: 'status-not-started',
  IN_PROGRESS: 'status-in-progress',
  COMPLETED: 'status-completed',
  OVERDUE: 'status-overdue',
};

const TREATMENT_STRATEGY_LABEL: Record<string, string> = {
  AVOID: 'Avoid',
  REDUCE: 'Reduce',
  TRANSFER: 'Transfer',
  ACCEPT: 'Accept',
};

export function treatmentStrategyLabel(value: string | null): string {
  return value ? (TREATMENT_STRATEGY_LABEL[value] ?? value) : '—';
}
