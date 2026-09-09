import { Injectable } from '@nestjs/common';
import { ControlEffectiveness, TestResult, TreatmentActionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OPEN_RISK_STATUSES } from '../../common/risk-status/open-risk-statuses';
import { riskDisplayCode } from '../../common/display-code/display-code.util';

/**
 * Every method returns one independent "tile" payload. Dashboards assemble
 * tiles into a keyed object (see getExecutiveTiles/getOperationalTiles) so a
 * future tile (an AI Governance risk-tier tile, a Supplier Risk heatmap) can
 * be added as one more key without restructuring the response or the page.
 *
 * Every method also accepts the topbar's optional org-unit filter and
 * combines it with the user's own org-unit scope via
 * OrgUnitScopeService.orgUnitWhere, the same pattern RisksService uses -
 * so picking an org unit narrows a tile without ever widening what the
 * user's role already restricts them to.
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
  ) {}

  private async openRisksByBand(user: AuthenticatedUser, orgUnitId?: string) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), status: { in: OPEN_RISK_STATUSES } },
      select: { inherentBand: true },
    });
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const r of risks) counts[r.inherentBand] += 1;
    return counts;
  }

  /** New risks per month for the last 6 months, broken down by inherent band so the trend chart can plot one line per band. */
  private async riskTrend(user: AuthenticatedUser, orgUnitId?: string) {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), createdAt: { gte: since } },
      select: { createdAt: true, inherentBand: true },
    });
    const buckets = new Map<string, { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
    }
    for (const r of risks) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (bucket) bucket[r.inherentBand] += 1;
    }
    return Array.from(buckets.entries()).map(([month, counts]) => ({
      month,
      newRisksCount: counts.LOW + counts.MEDIUM + counts.HIGH + counts.CRITICAL,
      ...counts,
    }));
  }

  private async heatMapByOrgUnit(user: AuthenticatedUser, orgUnitId?: string) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), status: { in: OPEN_RISK_STATUSES } },
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

  private async topOpenRisks(user: AuthenticatedUser, orgUnitId?: string) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), status: { in: OPEN_RISK_STATUSES } },
      select: { id: true, title: true, inherentScore: true, residualScore: true, orgUnit: { select: { name: true } } },
    });
    // Current exposure = residual score once treatment has been scored, else inherent.
    return risks
      .map((r) => ({ id: r.id, title: r.title, score: r.residualScore ?? r.inherentScore, orgUnit: r.orgUnit }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private async controlTestPassRate(user: AuthenticatedUser, orgUnitId?: string) {
    const controlWhere = this.scope.orgUnitWhere(user, orgUnitId);
    const [total, passed] = await Promise.all([
      this.prisma.controlTest.count({ where: { control: controlWhere } }),
      this.prisma.controlTest.count({ where: { control: controlWhere, result: TestResult.PASS } }),
    ]);
    return { total, passed, passRatePercent: total > 0 ? Math.round((passed / total) * 100) : 0 };
  }

  private async frameworkCoverage(user: AuthenticatedUser, orgUnitId?: string) {
    const frameworks = await this.prisma.framework.findMany({
      where: this.scope.orgUnitWhere(user, orgUnitId),
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

  private async assessmentProgressStatus(user: AuthenticatedUser, orgUnitId?: string) {
    const assessments = await this.prisma.riskAssessment.findMany({
      where: this.scope.orgUnitWhere(user, orgUnitId),
      select: { status: true, dueDate: true },
    });
    const now = new Date();
    let onTrack = 0;
    let overdue = 0;
    for (const a of assessments) {
      const isOverdue = a.status !== 'COMPLETED' && a.dueDate < now;
      if (isOverdue) overdue += 1;
      else onTrack += 1;
    }
    return { onTrack, overdue, total: assessments.length };
  }

  private overdueRiskReviewsWhere(user: AuthenticatedUser, orgUnitId?: string) {
    return {
      ...this.scope.orgUnitWhere(user, orgUnitId),
      status: { in: OPEN_RISK_STATUSES },
      nextReviewDate: { lt: new Date() },
    };
  }

  private async overdueRiskReviewsCount(user: AuthenticatedUser, orgUnitId?: string) {
    return this.prisma.risk.count({ where: this.overdueRiskReviewsWhere(user, orgUnitId) });
  }

  private async overdueRiskReviews(user: AuthenticatedUser, orgUnitId?: string) {
    const risks = await this.prisma.risk.findMany({
      where: this.overdueRiskReviewsWhere(user, orgUnitId),
      select: {
        id: true,
        title: true,
        nextReviewDate: true,
        orgUnit: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { nextReviewDate: 'asc' },
    });
    const now = Date.now();
    return risks.map((r) => ({
      ...r,
      daysOverdue: Math.max(1, Math.round((now - r.nextReviewDate!.getTime()) / (24 * 60 * 60 * 1000))),
    }));
  }

  /** Average residual score across open risks that have one entered - null (not 0) when none do, so the UI can show "—". */
  private async avgResidualScore(user: AuthenticatedUser, orgUnitId?: string) {
    const result = await this.prisma.risk.aggregate({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), status: { in: OPEN_RISK_STATUSES }, residualScore: { not: null } },
      _avg: { residualScore: true },
    });
    return result._avg.residualScore != null ? Math.round(result._avg.residualScore * 10) / 10 : null;
  }

  private async myAssignedRisks(user: AuthenticatedUser, orgUnitId?: string) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), status: { in: OPEN_RISK_STATUSES }, ownerId: user.id },
      select: { nextReviewDate: true },
    });
    const now = new Date();
    const needsReview = risks.filter((r) => r.nextReviewDate && r.nextReviewDate < now).length;
    return { count: risks.length, needsReview };
  }

  private async openRisksByOwner(user: AuthenticatedUser, orgUnitId?: string) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), status: { in: OPEN_RISK_STATUSES } },
      select: { owner: { select: { id: true, name: true } } },
    });
    const counts = new Map<string, { ownerId: string; ownerName: string; count: number }>();
    for (const r of risks) {
      const existing = counts.get(r.owner.id);
      if (existing) existing.count += 1;
      else counts.set(r.owner.id, { ownerId: r.owner.id, ownerName: r.owner.name, count: 1 });
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  private async recentRisks(user: AuthenticatedUser, orgUnitId?: string) {
    const risks = await this.prisma.risk.findMany({
      where: { ...this.scope.orgUnitWhere(user, orgUnitId), status: { in: OPEN_RISK_STATUSES } },
      select: { id: true, title: true, inherentBand: true, inherentScore: true, residualScore: true, orgUnit: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    return risks.map((r) => ({ ...r, score: r.residualScore ?? r.inherentScore }));
  }

  private async overdueTreatmentActions(user: AuthenticatedUser, orgUnitId?: string) {
    return this.prisma.treatmentAction.findMany({
      where: {
        status: { not: TreatmentActionStatus.COMPLETED },
        dueDate: { lt: new Date() },
        risk: this.scope.orgUnitWhere(user, orgUnitId),
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

  private async controlsDueForTesting(user: AuthenticatedUser, orgUnitId?: string) {
    const controls = await this.prisma.control.findMany({
      where: this.scope.orgUnitWhere(user, orgUnitId),
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

  async getExecutiveTiles(user: AuthenticatedUser, orgUnitId?: string) {
    const [
      openRisksByBand,
      riskTrend,
      heatMapByOrgUnit,
      topRisks,
      testPassRate,
      frameworkCoverage,
      assessmentProgressStatus,
      overdueRiskReviewsCount,
      avgResidualScore,
    ] = await Promise.all([
      this.openRisksByBand(user, orgUnitId),
      this.riskTrend(user, orgUnitId),
      this.heatMapByOrgUnit(user, orgUnitId),
      this.topOpenRisks(user, orgUnitId),
      this.controlTestPassRate(user, orgUnitId),
      this.frameworkCoverage(user, orgUnitId),
      this.assessmentProgressStatus(user, orgUnitId),
      this.overdueRiskReviewsCount(user, orgUnitId),
      this.avgResidualScore(user, orgUnitId),
    ]);

    return {
      openRisksByBand,
      riskTrend,
      heatMapByOrgUnit,
      topOpenRisks: topRisks,
      controlTestPassRate: testPassRate,
      frameworkCoverage,
      assessmentProgressStatus,
      overdueRiskReviewsCount,
      avgResidualScore,
    };
  }

  async getOperationalTiles(user: AuthenticatedUser, orgUnitId?: string) {
    const [executiveTiles, overdueReviews, overdueActions, controlsDue, riskTable, myAssignedRisks, openRisksByOwner, recentRisks] =
      await Promise.all([
        this.getExecutiveTiles(user, orgUnitId),
        this.overdueRiskReviews(user, orgUnitId),
        this.overdueTreatmentActions(user, orgUnitId),
        this.controlsDueForTesting(user, orgUnitId),
        this.prisma.risk
          .findMany({
            where: this.scope.orgUnitWhere(user, orgUnitId),
            include: { category: true, orgUnit: true, owner: { select: { id: true, name: true } } },
            orderBy: { updatedAt: 'desc' },
          })
          .then((risks) => risks.map((r) => ({ ...r, code: riskDisplayCode(r.sequenceNumber) }))),
        this.myAssignedRisks(user, orgUnitId),
        this.openRisksByOwner(user, orgUnitId),
        this.recentRisks(user, orgUnitId),
      ]);

    return {
      ...executiveTiles,
      overdueRiskReviews: overdueReviews,
      overdueTreatmentActions: overdueActions,
      controlsDueForTesting: controlsDue,
      riskTable,
      myAssignedRisks,
      openRisksByOwner,
      recentRisks,
    };
  }
}
