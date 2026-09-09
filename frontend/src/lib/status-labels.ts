import { AssessmentStatus, RiskStatus, TreatmentActionStatus, UserAccountStatus, UserRole, UserSource } from './types';

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

// Role pill text is deliberately fuller than the sidebar's short ROLE_LABEL
// (e.g. "Executive/Board Viewer") - see the Users page mockup.
export const USER_ROLE_PILL_LABEL: Record<UserRole, string> = {
  ADMIN: 'Admin',
  RISK_OWNER: 'Risk Owner',
  AUDITOR: 'Auditor',
  EXECUTIVE: 'Executive/Board Viewer',
};
export const USER_ROLE_PILL_CLASS: Record<UserRole, string> = {
  ADMIN: 'role-admin',
  RISK_OWNER: 'role-riskowner',
  AUDITOR: 'role-auditor',
  EXECUTIVE: 'role-exec',
};

export const USER_SOURCE_LABEL: Record<UserSource, string> = {
  ENTRA_SSO: 'Entra SSO',
  MANUAL: 'Manual',
};
export const USER_SOURCE_CLASS: Record<UserSource, string> = {
  ENTRA_SSO: 'tag-source-sso',
  MANUAL: 'tag-source-manual',
};

export const USER_ACCOUNT_STATUS_LABEL: Record<UserAccountStatus, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  DEACTIVATED: 'Deactivated',
};
export const USER_ACCOUNT_STATUS_CLASS: Record<UserAccountStatus, string> = {
  ACTIVE: 'status-active',
  INVITED: 'status-invited',
  DEACTIVATED: 'status-deactivated',
};
