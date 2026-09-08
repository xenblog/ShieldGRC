import { Injectable } from '@nestjs/common';
import { AssessmentStatus, ControlEffectiveness, TestResult, TreatmentActionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OPEN_RISK_STATUSES } from '../../common/risk-status/open-risk-statuses';

/**
 * Every method returns one independent "tile" payload. Dashboards assemble
 * tiles into a keyed object (see getExecutiveTiles/getOperationalTiles) so a
 * future tile (an AI Governance risk-tier tile, a Supplier Risk heatmap) can
 * be added as one more key without restructuring the response or the page.
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
  ) {}

  private async openRisksByBand(user: AuthenticatedUser) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.readWhere(user), status: { in: OPEN_RISK_STATUSES } },
      select: { inherentBand: true },
    });
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const r of risks) counts[r.inherentBand] += 1;
    return counts;
  }

  private async riskTrend(user: AuthenticatedUser) {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.readWhere(user), createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const buckets = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const r of risks) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([month, newRisksCount]) => ({ month, newRisksCount }));
  }

  private async heatMapByOrgUnit(user: AuthenticatedUser) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.readWhere(user), status: { in: OPEN_RISK_STATUSES } },
      select: { orgUnitId: true, orgUnit: { select: { name: true } }, inherentBand: true },
    });
    const byOrgUnit = new Map<string, { orgUnitName: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }>();
    for (const r of risks) {
      if (!byOrgUnit.has(r.orgUnitId)) {
        byOrgUnit.set(r.orgUnitId, { orgUnitName: r.orgUnit.name, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
      }
      byOrgUnit.get(r.orgUnitId)![r.inherentBand] += 1;
    }
    return Array.from(byOrgUnit.entries()).map(([orgUnitId, counts]) => ({ orgUnitId, ...counts }));
  }

  private async topOpenRisks(user: AuthenticatedUser) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.readWhere(user), status: { in: OPEN_RISK_STATUSES } },
      select: { id: true, title: true, inherentScore: true, residualScore: true },
    });
    // Current exposure = residual score once treatment has been scored, else inherent.
    return risks
      .map((r) => ({ id: r.id, title: r.title, score: r.residualScore ?? r.inherentScore }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private async controlTestPassRate(user: AuthenticatedUser) {
    const controlWhere = this.scope.readWhere(user);
    const [total, passed] = await Promise.all([
      this.prisma.controlTest.count({ where: { control: controlWhere } }),
      this.prisma.controlTest.count({ where: { control: controlWhere, result: TestResult.PASS } }),
    ]);
    return { total, passed, passRatePercent: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }

  private async frameworkCoverage(user: AuthenticatedUser) {
    const frameworks = await this.prisma.framework.findMany({
      where: this.scope.readWhere(user),
      include: { controlLinks: { include: { control: { select: { effectiveness: true } } } } },
    });
    return frameworks.map((f) => {
      const controls = f.controlLinks.map((l) => l.control);
      const effective = controls.filter((c) => c.effectiveness === ControlEffectiveness.EFFECTIVE).length;
      return {
        frameworkId: f.id,
        name: f.name,
        coveragePercent: controls.length > 0 ? Math.round((effective / controls.length) * 100) : 0,
      };
    });
  }

  private async assessmentProgressStatus(user: AuthenticatedUser) {
    const assessments = await this.prisma.riskAssessment.findMany({
      where: this.scope.readWhere(user),
      select: { status: true, dueDate: true },
    });
    const now = new Date();
    let onTrack = 0;
    let overdue = 0;
    for (const a of assessments) {
      const isOverdue =
        a.status !== AssessmentStatus.COMPLETED &&
        (a.status === AssessmentStatus.OVERDUE || a.dueDate < now);
      if (isOverdue) overdue += 1;
      else onTrack += 1;
    }
    return { onTrack, overdue, total: assessments.length };
  }

  private async overdueRiskReviews(user: AuthenticatedUser) {
    return this.prisma.risk.findMany({
      where: {
        ...this.scope.readWhere(user),
        status: { in: OPEN_RISK_STATUSES },
        nextReviewDate: { lt: new Date() },
      },
      select: { id: true, title: true, nextReviewDate: true, orgUnitId: true },
      orderBy: { nextReviewDate: 'asc' },
    });
  }

  private async overdueTreatmentActions(user: AuthenticatedUser) {
    return this.prisma.treatmentAction.findMany({
      where: {
        status: { not: TreatmentActionStatus.COMPLETED },
        dueDate: { lt: new Date() },
        risk: this.scope.readWhere(user),
      },
      select: {
        id: true,
        description: true,
        dueDate: true,
        owner: { select: { id: true, name: true } },
        risk: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  private async controlsDueForTesting(user: AuthenticatedUser) {
    const controls = await this.prisma.control.findMany({
      where: this.scope.readWhere(user),
      select: {
        id: true,
        code: true,
        name: true,
        tests: { orderBy: { testedDate: 'desc' }, take: 1, select: { dueDate: true } },
      },
    });
    const soonThreshold = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return controls
      .filter((c) => c.tests[0] && c.tests[0].dueDate.getTime() < soonThreshold)
      .map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        nextTestDueDate: c.tests[0].dueDate,
        isOverdue: c.tests[0].dueDate.getTime() < Date.now(),
      }))
      .sort((a, b) => a.nextTestDueDate.getTime() - b.nextTestDueDate.getTime());
  }

  async getExecutiveTiles(user: AuthenticatedUser) {
    const [openRisksByBand, riskTrend, heatMapByOrgUnit, topRisks, testPassRate, frameworkCoverage, assessmentProgressStatus] =
      await Promise.all([
        this.openRisksByBand(user),
        this.riskTrend(user),
        this.heatMapByOrgUnit(user),
        this.topOpenRisks(user),
        this.controlTestPassRate(user),
        this.frameworkCoverage(user),
        this.assessmentProgressStatus(user),
      ]);

    return {
      openRisksByBand,
      riskTrend,
      heatMapByOrgUnit,
      topOpenRisks: topRisks,
      controlTestPassRate: testPassRate,
      frameworkCoverage,
      assessmentProgressStatus,
    };
  }

  async getOperationalTiles(user: AuthenticatedUser) {
    const [executiveTiles, overdueReviews, overdueActions, controlsDue, riskTable] = await Promise.all([
      this.getExecutiveTiles(user),
      this.overdueRiskReviews(user),
      this.overdueTreatmentActions(user),
      this.controlsDueForTesting(user),
      this.prisma.risk.findMany({
        where: this.scope.readWhere(user),
        include: { category: true, orgUnit: true, owner: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      ...executiveTiles,
      overdueRiskReviews: overdueReviews,
      overdueTreatmentActions: overdueActions,
      controlsDueForTesting: controlsDue,
      riskTable,
    };
  }
}
