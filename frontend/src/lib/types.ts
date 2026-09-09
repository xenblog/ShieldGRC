export type UserRole = 'ADMIN' | 'RISK_OWNER' | 'AUDITOR' | 'EXECUTIVE';
export type RiskStatus = 'IDENTIFIED' | 'ASSESSED' | 'MITIGATING' | 'ACCEPTED' | 'CLOSED';
export type ScoreBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TreatmentStrategy = 'AVOID' | 'REDUCE' | 'TRANSFER' | 'ACCEPT';
export type AssessmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED';
export type TreatmentActionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
export type NistCsfFunction = 'GOVERN' | 'IDENTIFY' | 'PROTECT' | 'DETECT' | 'RESPOND' | 'RECOVER';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface OrgUnit {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string | null;
  actor: { id: string; name: string; email: string } | null;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
}

export interface Risk {
  id: string;
  code: string;
  title: string;
  description: string;
  categoryId: string;
  category: Category;
  orgUnitId: string;
  orgUnit: OrgUnit;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  status: RiskStatus;
  likelihood: number;
  impact: number;
  inherentScore: number;
  inherentBand: ScoreBand;
  treatmentStrategy: TreatmentStrategy | null;
  treatmentNote: string | null;
  // Manually entered by the risk owner (1-25) - not derived from a
  // likelihood/impact pair. Only the band is computed, live, from this value.
  residualScore: number | null;
  residualBand: ScoreBand | null;
  notes: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
}

export interface RiskDetail extends Risk {
  linkedAssessments: { id: string; code: string; name: string; status: AssessmentStatus }[];
  treatmentActions: EmbeddedTreatmentAction[];
  auditHistory: AuditLogEntry[];
}

export interface RiskGroup {
  category: Category;
  count: number;
  avgResidualScore: number | null;
  risks: Risk[];
}

export interface HeatMapCell {
  likelihood: number;
  impact: number;
  count: number;
  band: ScoreBand;
}

/** Treatment action as embedded within a Risk detail view - the risk is already known, so no risk back-reference. */
export interface EmbeddedTreatmentAction {
  id: string;
  description: string;
  owner: { id: string; name: string };
  status: TreatmentActionStatus;
  dueDate: string;
}

/** Treatment action as embedded within a RiskAssessment detail view - carries the risk it belongs to. */
export interface EmbeddedAssessmentTreatmentAction extends EmbeddedTreatmentAction {
  risk: { id: string; code: string };
}

/** Treatment action from the standalone /treatment-actions endpoints - carries its own risk/assessment references. */
export interface TreatmentAction {
  id: string;
  description: string;
  riskId: string;
  risk: { id: string; code: string; title: string; orgUnitId: string };
  assessmentId: string | null;
  assessment: { id: string; code: string; name: string } | null;
  owner: { id: string; name: string };
  status: TreatmentActionStatus;
  dueDate: string;
  isOverdue: boolean;
}

export interface RiskAssessment {
  id: string;
  code: string;
  name: string;
  scope: string;
  orgUnitId: string;
  orgUnit: OrgUnit;
  leadAssessorId: string;
  leadAssessor: { id: string; name: string; email: string };
  startDate: string;
  dueDate: string;
  status: AssessmentStatus;
  progressPercent: number;
  progressOverride: boolean;
  progressManualValue: number | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
}

export interface RiskAssessmentDetail extends RiskAssessment {
  linkedRisks: {
    id: string;
    code: string;
    title: string;
    status: RiskStatus;
    inherentScore: number;
    inherentBand: ScoreBand;
    category: Category;
    owner: { id: string; name: string };
  }[];
  treatmentActions: EmbeddedAssessmentTreatmentAction[];
  auditHistory: AuditLogEntry[];
}

export interface MethodologyVersion {
  id: string;
  version: number;
  frameworkReference: string;
  contentHtml: string;
  isCurrent: boolean;
  authorId: string;
  author: { id: string; name: string; email: string };
  createdAt: string;
}
