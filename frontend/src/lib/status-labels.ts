import {
  AssessmentStatus,
  BusinessProcessCriticalityTier,
  ControlEffectiveness,
  ControlFrequency,
  ControlType,
  RiskStatus,
  TestMethod,
  TestResult,
  TreatmentActionStatus,
  UserAccountStatus,
  UserRole,
  UserSource,
} from './types';

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

export const CONTROL_TYPE_LABEL: Record<ControlType, string> = {
  PREVENTIVE: 'Preventive',
  DETECTIVE: 'Detective',
  CORRECTIVE: 'Corrective',
  COMPENSATING: 'Compensating',
};

export const CONTROL_FREQUENCY_LABEL: Record<ControlFrequency, string> = {
  CONTINUOUS: 'Continuous',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
};

export const CONTROL_EFFECTIVENESS_LABEL: Record<ControlEffectiveness, string> = {
  EFFECTIVE: 'Effective',
  PARTIALLY_EFFECTIVE: 'Partially Effective',
  INEFFECTIVE: 'Ineffective',
  NOT_YET_TESTED: 'Not Yet Tested',
};
export const CONTROL_EFFECTIVENESS_CLASS: Record<ControlEffectiveness, string> = {
  EFFECTIVE: 'status-effective',
  PARTIALLY_EFFECTIVE: 'status-partially-effective',
  INEFFECTIVE: 'status-ineffective',
  NOT_YET_TESTED: 'status-not-yet-tested',
};

export const TEST_RESULT_LABEL: Record<TestResult, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  PARTIAL: 'Partial',
};
export const TEST_RESULT_CLASS: Record<TestResult, string> = {
  PASS: 'status-effective',
  FAIL: 'status-ineffective',
  PARTIAL: 'status-partially-effective',
};

export const TEST_METHOD_LABEL: Record<TestMethod, string> = {
  INSPECTION: 'Inspection',
  WALKTHROUGH: 'Walkthrough',
  REPERFORMANCE: 'Reperformance',
  AUTOMATED: 'Automated',
};

export const CRITICALITY_TIER_LABEL: Record<BusinessProcessCriticalityTier, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};
// BusinessProcessCriticalityTier shares its exact values with ScoreBand, so
// the same badge-* classes (globals.css) apply without new CSS.
export const CRITICALITY_TIER_BADGE_CLASS: Record<BusinessProcessCriticalityTier, string> = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
};
