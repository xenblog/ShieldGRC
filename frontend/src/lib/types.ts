export type UserRole = 'ADMIN' | 'RISK_OWNER' | 'AUDITOR' | 'EXECUTIVE';
export type UserAccountStatus = 'ACTIVE' | 'INVITED' | 'DEACTIVATED';
export type UserSource = 'MANUAL' | 'ENTRA_SSO';
export type RiskStatus = 'IDENTIFIED' | 'ASSESSED' | 'MITIGATING' | 'ACCEPTED' | 'CLOSED';
export type ScoreBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TreatmentStrategy = 'AVOID' | 'REDUCE' | 'TRANSFER' | 'ACCEPT';
export type AssessmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED';
export type TreatmentActionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
export type NistCsfFunction = 'GOVERN' | 'IDENTIFY' | 'PROTECT' | 'DETECT' | 'RESPOND' | 'RECOVER';
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type ControlType = 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'COMPENSATING';
export type ControlFrequency = 'CONTINUOUS' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type ControlEffectiveness = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'NOT_YET_TESTED';
export type TestResult = 'PASS' | 'FAIL' | 'PARTIAL';
export type TestMethod = 'INSPECTION' | 'WALKTHROUGH' | 'REPERFORMANCE' | 'AUTOMATED';
// Whether Risk.residualScore was last set by ResidualScoringService (from
// linked Controls) or by an explicit manual override - see Risk.residualSource.
export type ResidualScoreSource = 'COMPUTED' | 'MANUAL';
export type BusinessProcessCriticalityTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

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

/** Row shape from the admin Users CRUD endpoints - the RBAC/org-unit source of truth. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  status: UserAccountStatus;
  source: UserSource;
  lastLoginAt: string | null;
  orgUnits: OrgUnit[];
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
  // The effective residual score (1-25): either live-computed from linked
  // Controls (residualSource === 'COMPUTED') or residualScoreOverride
  // (residualSource === 'MANUAL'). null when there's no override and no
  // linked Controls with a test result yet.
  residualScore: number | null;
  residualBand: ScoreBand | null;
  residualSource: ResidualScoreSource | null;
  residualScoreOverride: number | null;
  notes: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  linkedControls: LinkedControl[];
}

/** Control as embedded within a Risk (list or detail) - just enough to render a chip/row. */
export interface LinkedControl {
  id: string;
  code: string;
  name: string;
  type: ControlType;
  effectiveness: ControlEffectiveness;
}

export interface RiskDetail extends Risk {
  treatmentActions: EmbeddedTreatmentAction[];
  auditHistory: AuditLogEntry[];
}

export interface PaginatedRisks {
  items: Risk[];
  total: number;
}

export interface Framework {
  id: string;
  name: string;
  description: string;
  orgUnitId: string;
  orgUnit: OrgUnit;
  ownerId: string;
  owner: { id: string; name: string; email: string };
}

export interface Control {
  id: string;
  code: string;
  name: string;
  domainCategoryId: string;
  domainCategory: Category;
  nistCsfFunction: NistCsfFunction | null;
  orgUnitId: string;
  orgUnit: OrgUnit;
  type: ControlType;
  frequency: ControlFrequency;
  effectiveness: ControlEffectiveness;
  lastTestedAt: string | null;
  frameworks: Framework[];
  createdAt: string;
  updatedAt: string;
}

/** Risk as embedded within a Control detail view - just enough to render a row/link. */
export interface LinkedRisk {
  id: string;
  code: string;
  title: string;
  inherentScore: number;
  inherentBand: ScoreBand;
}

export interface Evidence {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; name: string; email: string };
  uploadedAt: string;
}

export interface ControlTest {
  id: string;
  controlId: string;
  control: { id: string; code: string; name: string; orgUnitId: string };
  result: TestResult;
  testMethod: TestMethod;
  testerId: string;
  tester: { id: string; name: string; email: string };
  cycle: string;
  testedDate: string;
  dueDate: string;
  exceptionNotes: string | null;
  evidence: Evidence[];
  isDueSoon: boolean;
  isOverdue: boolean;
}

export interface ControlDetail extends Control {
  tests: ControlTest[];
  linkedRisks: LinkedRisk[];
  auditHistory: AuditLogEntry[];
}

export interface BusinessProcess {
  id: string;
  code: string;
  name: string;
  description: string | null;
  orgUnitId: string;
  orgUnit: OrgUnit;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  criticalityTier: BusinessProcessCriticalityTier;
  rtoMinutes: number | null;
  rpoMinutes: number | null;
  // CIA triad rating (1-3: Low/Medium/High) - independent of criticalityTier.
  confidentialityScore: number | null;
  integrityScore: number | null;
  availabilityScore: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Business Process as embedded within another one's dependency lists - just enough to render a chip/row. */
export interface LinkedBusinessProcess {
  id: string;
  code: string;
  name: string;
  criticalityTier: BusinessProcessCriticalityTier;
}

export interface BusinessProcessDetail extends BusinessProcess {
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
  // Other Business Processes this one depends on ("A needs B to run").
  dependsOn: LinkedBusinessProcess[];
  // Business Processes that depend on this one (read-only here - set from the dependent's own page).
  dependents: LinkedBusinessProcess[];
  auditHistory: AuditLogEntry[];
}

export interface PaginatedBusinessProcesses {
  items: BusinessProcess[];
  total: number;
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
