import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ControlEffectiveness, Prisma, TestResult } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
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
  ) {}

  private commonInclude() {
    return {
      domainCategory: true,
      orgUnit: true,
      frameworkLinks: { include: { framework: true } },
    } satisfies Prisma.ControlInclude;
  }

  async findAll(user: AuthenticatedUser, query: QueryControlsDto) {
    const where: Prisma.ControlWhereInput = { ...this.scope.orgUnitWhere(user, query.orgUnitId) };
    if (query.domainCategoryId) where.domainCategoryId = query.domainCategoryId;
    if (query.type) where.type = query.type;
    if (query.effectiveness) where.effectiveness = query.effectiveness;
    if (query.frameworkId) {
      where.frameworkLinks = { some: { frameworkId: query.frameworkId } };
    }

    const controls = await this.prisma.control.findMany({
      where,
      include: this.commonInclude(),
      orderBy: { code: 'asc' },
    });
    return controls.map((c) => ({ ...c, frameworks: c.frameworkLinks.map((l) => l.framework) }));
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
      },
    });
    if (!control) throw new NotFoundException('Control not found');
    this.scope.assertCanReadOrgUnit(user, control.orgUnitId);

    const auditHistory = await this.audit.findForEntity('Control', id);

    return {
      ...control,
      frameworks: control.frameworkLinks.map((l) => l.framework),
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
          frameworkLinks: dto.frameworkIds
            ? { create: dto.frameworkIds.map((frameworkId) => ({ frameworkId })) }
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
      if (dto.frameworkIds) {
        await tx.controlFramework.deleteMany({ where: { controlId: id } });
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
          frameworkLinks: dto.frameworkIds
            ? { create: dto.frameworkIds.map((frameworkId) => ({ frameworkId })) }
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
      await tx.control.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'Control',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
    });
  }

  /**
   * Called by ControlTestsService after any test create/update: recomputes
   * the parent Control's denormalized effectiveness/lastTestedAt from
   * whichever test is now the most recently tested one.
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
  }
}
