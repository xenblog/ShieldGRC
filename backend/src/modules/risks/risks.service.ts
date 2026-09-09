import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, RiskStatus, ScoreBand } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OPEN_RISK_STATUSES } from '../../common/risk-status/open-risk-statuses';
import { recalculateRiskScores, scoreToBand } from '../../common/scoring/scoring.util';
import { assessmentDisplayCode, riskDisplayCode } from '../../common/display-code/display-code.util';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';
import { QueryRisksDto } from './dto/query-risks.dto';

/** A risk whose next review date has passed - CLOSED risks are never flagged, they don't need re-review. */
function computeIsOverdue(risk: { status: RiskStatus; nextReviewDate: Date | null }): boolean {
  return risk.status !== RiskStatus.CLOSED && !!risk.nextReviewDate && risk.nextReviewDate < new Date();
}

@Injectable()
export class RisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
    private readonly audit: AuditService,
  ) {}

  private commonInclude() {
    return {
      category: true,
      orgUnit: true,
      owner: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.RiskInclude;
  }

  private withComputed<T extends { status: RiskStatus; nextReviewDate: Date | null; sequenceNumber: number }>(risk: T) {
    return { ...risk, isOverdue: computeIsOverdue(risk), code: riskDisplayCode(risk.sequenceNumber) };
  }

  private buildWhere(user: AuthenticatedUser, query: QueryRisksDto): Prisma.RiskWhereInput {
    return {
      ...this.scope.orgUnitWhere(user, query.orgUnitId),
      categoryId: query.categoryId,
      status: query.status,
      inherentBand: query.band,
      ownerId: query.ownerId,
      likelihood: query.likelihood,
      impact: query.impact,
    };
  }

  async findAll(user: AuthenticatedUser, query: QueryRisksDto) {
    const risks = await this.prisma.risk.findMany({
      where: this.buildWhere(user, query),
      include: this.commonInclude(),
      orderBy: { updatedAt: 'desc' },
    });
    return risks.map((r) => this.withComputed(r));
  }

  async findGrouped(user: AuthenticatedUser, query: QueryRisksDto) {
    const [risks, categories] = await Promise.all([
      this.prisma.risk.findMany({
        where: this.buildWhere(user, query),
        include: this.commonInclude(),
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    const byCategory = new Map<string, typeof risks>();
    for (const risk of risks) {
      const bucket = byCategory.get(risk.categoryId);
      if (bucket) bucket.push(risk);
      else byCategory.set(risk.categoryId, [risk]);
    }

    return categories
      .filter((c) => byCategory.has(c.id))
      .map((category) => {
        const categoryRisks = byCategory.get(category.id)!;
        const withResidual = categoryRisks.filter((r) => r.residualScore != null);
        const avgResidualScore =
          withResidual.length > 0
            ? withResidual.reduce((sum, r) => sum + r.residualScore!, 0) / withResidual.length
            : null;
        return {
          category,
          count: categoryRisks.length,
          avgResidualScore,
          risks: categoryRisks.map((r) => this.withComputed(r)),
        };
      });
  }

  /** Every likelihood x impact cell (25 total, even ones with zero open risks) so the grid is fully colored by band. */
  async findHeatMap(user: AuthenticatedUser, query: Pick<QueryRisksDto, 'orgUnitId' | 'categoryId'>) {
    const risks = await this.prisma.risk.findMany({
      where: {
        ...this.scope.orgUnitWhere(user, query.orgUnitId),
        categoryId: query.categoryId,
        status: { in: OPEN_RISK_STATUSES },
      },
      select: { likelihood: true, impact: true },
    });

    const counts = new Map<string, number>();
    for (const r of risks) {
      const key = `${r.likelihood}:${r.impact}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const cells: { likelihood: number; impact: number; count: number; band: ScoreBand }[] = [];
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      for (let impact = 1; impact <= 5; impact++) {
        cells.push({
          likelihood,
          impact,
          count: counts.get(`${likelihood}:${impact}`) ?? 0,
          band: scoreToBand(likelihood * impact),
        });
      }
    }
    return cells;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const risk = await this.prisma.risk.findUnique({
      where: { id },
      include: {
        ...this.commonInclude(),
        assessmentLinks: {
          include: { assessment: { select: { id: true, name: true, status: true, sequenceNumber: true, startDate: true } } },
        },
        treatmentActions: {
          orderBy: { dueDate: 'asc' },
          include: { owner: { select: { id: true, name: true } } },
        },
      },
    });
    if (!risk) throw new NotFoundException('Risk not found');
    this.scope.assertCanReadOrgUnit(user, risk.orgUnitId);

    const auditHistory = await this.audit.findForEntity('Risk', id);

    return {
      ...this.withComputed(risk),
      linkedAssessments: risk.assessmentLinks.map((l) => ({
        ...l.assessment,
        code: assessmentDisplayCode(l.assessment.sequenceNumber, l.assessment.startDate),
      })),
      auditHistory,
    };
  }

  async create(dto: CreateRiskDto, user: AuthenticatedUser) {
    this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);
    const scores = recalculateRiskScores(dto);

    const risk = await this.prisma.$transaction(async (tx) => {
      const created = await tx.risk.create({
        data: {
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId,
          orgUnitId: dto.orgUnitId,
          ownerId: dto.ownerId,
          status: dto.status,
          likelihood: dto.likelihood,
          impact: dto.impact,
          inherentScore: scores.inherentScore,
          inherentBand: scores.inherentBand,
          treatmentStrategy: dto.treatmentStrategy,
          treatmentNote: dto.treatmentNote,
          residualScore: scores.residualScore,
          residualBand: scores.residualBand,
          notes: dto.notes,
          nextReviewDate: dto.nextReviewDate,
        },
      });
      await this.audit.record(tx, {
        entityType: 'Risk',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });

    return this.findOne(risk.id, user);
  }

  async update(id: string, dto: UpdateRiskDto, user: AuthenticatedUser) {
    const existing = await this.prisma.risk.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Risk not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);
    if (dto.orgUnitId && dto.orgUnitId !== existing.orgUnitId) {
      this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);
    }

    // Live scoring: recompute from whichever likelihood/impact/residual values
    // are in effect after this update, not just the ones the caller sent.
    const scores = recalculateRiskScores({
      likelihood: dto.likelihood ?? existing.likelihood,
      impact: dto.impact ?? existing.impact,
      residualScore: dto.residualScore ?? existing.residualScore,
    });

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.risk.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId,
          orgUnitId: dto.orgUnitId,
          ownerId: dto.ownerId,
          status: dto.status,
          likelihood: dto.likelihood,
          impact: dto.impact,
          inherentScore: scores.inherentScore,
          inherentBand: scores.inherentBand,
          treatmentStrategy: dto.treatmentStrategy,
          treatmentNote: dto.treatmentNote,
          residualScore: scores.residualScore,
          residualBand: scores.residualBand,
          notes: dto.notes,
          nextReviewDate: dto.nextReviewDate,
        },
      });
      await this.audit.record(tx, {
        entityType: 'Risk',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: existing,
        after: updated,
      });
    });

    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.risk.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Risk not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.risk.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'Risk',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
    });
  }
}
