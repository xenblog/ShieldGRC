import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ControlEffectiveness, Prisma, TestResult } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { ResidualScoringService } from '../../common/scoring/residual-scoring.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { riskDisplayCode } from '../../common/display-code/display-code.util';
import { CreateControlDto } from './dto/create-control.dto';
import { UpdateControlDto } from './dto/update-control.dto';
import { QueryControlsDto } from './dto/query-controls.dto';

function effectivenessFromResult(result: TestResult): ControlEffectiveness {
  switch (result) {
    case TestResult.PASS:
      return ControlEffectiveness.EFFECTIVE;
    case TestResult.PARTIAL:
      return ControlEffectiveness.PARTIALLY_EFFECTIVE;
    case TestResult.FAIL:
      return ControlEffectiveness.INEFFECTIVE;
  }
}

@Injectable()
export class ControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
    private readonly audit: AuditService,
    private readonly residualScoring: ResidualScoringService,
  ) {}

  private commonInclude() {
    return {
      domainCategory: true,
      orgUnit: true,
      frameworkControlLinks: { include: { frameworkControl: { include: { framework: { select: { id: true, name: true } } } } } },
    } satisfies Prisma.ControlInclude;
  }

  private withFrameworkControls<T extends { frameworkControlLinks: { frameworkControl: unknown }[] }>(control: T) {
    const { frameworkControlLinks, ...rest } = control;
    return { ...rest, frameworkControls: frameworkControlLinks.map((l) => l.frameworkControl) };
  }

  async findAll(user: AuthenticatedUser, query: QueryControlsDto) {
    const where: Prisma.ControlWhereInput = { ...this.scope.orgUnitWhere(user, query.orgUnitId) };
    if (query.domainCategoryId) where.domainCategoryId = query.domainCategoryId;
    if (query.type) where.type = query.type;
    if (query.effectiveness) where.effectiveness = query.effectiveness;
    if (query.frameworkId) {
      where.frameworkControlLinks = { some: { frameworkControl: { frameworkId: query.frameworkId } } };
    }

    const controls = await this.prisma.control.findMany({
      where,
      include: this.commonInclude(),
      orderBy: { code: 'asc' },
    });
    return controls.map((c) => this.withFrameworkControls(c));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const control = await this.prisma.control.findUnique({
      where: { id },
      include: {
        ...this.commonInclude(),
        tests: {
          orderBy: { testedDate: 'desc' },
          include: {
            tester: { select: { id: true, name: true, email: true } },
            evidence: true,
          },
        },
        riskLinks: {
          include: { risk: { select: { id: true, sequenceNumber: true, title: true, inherentScore: true, inherentBand: true } } },
        },
      },
    });
    if (!control) throw new NotFoundException('Control not found');
    this.scope.assertCanReadOrgUnit(user, control.orgUnitId);

    const auditHistory = await this.audit.findForEntity('Control', id);

    return {
      ...this.withFrameworkControls(control),
      linkedRisks: control.riskLinks.map((l) => ({ ...l.risk, code: riskDisplayCode(l.risk.sequenceNumber) })),
      auditHistory,
    };
  }

  async create(dto: CreateControlDto, user: AuthenticatedUser) {
    this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);

    const control = await this.prisma.$transaction(async (tx) => {
      const created = await tx.control.create({
        data: {
          code: dto.code,
          name: dto.name,
          domainCategoryId: dto.domainCategoryId,
          nistCsfFunction: dto.nistCsfFunction,
          orgUnitId: dto.orgUnitId,
          type: dto.type,
          frequency: dto.frequency,
          frameworkControlLinks: dto.frameworkControlIds
            ? { create: dto.frameworkControlIds.map((frameworkControlId) => ({ frameworkControlId })) }
            : undefined,
        },
      });
      await this.audit.record(tx, {
        entityType: 'Control',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });

    return this.findOne(control.id, user);
  }

  async update(id: string, dto: UpdateControlDto, user: AuthenticatedUser) {
    const existing = await this.prisma.control.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Control not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);
    if (dto.orgUnitId && dto.orgUnitId !== existing.orgUnitId) {
      this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.frameworkControlIds) {
        await tx.controlFrameworkControl.deleteMany({ where: { controlId: id } });
      }
      const updated = await tx.control.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          domainCategoryId: dto.domainCategoryId,
          nistCsfFunction: dto.nistCsfFunction,
          orgUnitId: dto.orgUnitId,
          type: dto.type,
          frequency: dto.frequency,
          frameworkControlLinks: dto.frameworkControlIds
            ? { create: dto.frameworkControlIds.map((frameworkControlId) => ({ frameworkControlId })) }
            : undefined,
        },
      });
      await this.audit.record(tx, {
        entityType: 'Control',
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
    const existing = await this.prisma.control.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Control not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      // Capture linked risks before the cascade delete removes the
      // risk_controls rows, so their residual score can be recomputed
      // without this Control once it's gone.
      const linkedRiskIds = (await tx.riskControl.findMany({ where: { controlId: id }, select: { riskId: true } })).map(
        (l) => l.riskId,
      );
      await tx.control.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'Control',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
      for (const riskId of linkedRiskIds) {
        await this.residualScoring.recalculateForRisk(riskId, tx);
      }
    });
  }

  /**
   * Called by ControlTestsService after any test create/update: recomputes
   * the parent Control's denormalized effectiveness/lastTestedAt from
   * whichever test is now the most recently tested one, then propagates
   * that change to the residual score of every Risk linked to this Control
   * (see ResidualScoringService - the propagation engine).
   */
  async recomputeFromLatestTest(controlId: string, tx: Prisma.TransactionClient): Promise<void> {
    const latest = await tx.controlTest.findFirst({
      where: { controlId },
      orderBy: { testedDate: 'desc' },
    });
    await tx.control.update({
      where: { id: controlId },
      data: {
        effectiveness: latest ? effectivenessFromResult(latest.result) : ControlEffectiveness.NOT_YET_TESTED,
        lastTestedAt: latest?.testedDate ?? null,
      },
    });
    await this.residualScoring.recalculateForRisksLinkedToControl(controlId, tx);
  }
}
