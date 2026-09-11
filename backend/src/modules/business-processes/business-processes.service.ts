import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { businessProcessDisplayCode, riskDisplayCode } from '../../common/display-code/display-code.util';
import { CreateBusinessProcessDto } from './dto/create-business-process.dto';
import { UpdateBusinessProcessDto } from './dto/update-business-process.dto';
import { QueryBusinessProcessesDto, BusinessProcessSortField } from './dto/query-business-processes.dto';
import { LinkRisksDto } from './dto/link-risks.dto';
import { LinkDependenciesDto } from './dto/link-dependencies.dto';

@Injectable()
export class BusinessProcessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
    private readonly audit: AuditService,
  ) {}

  private commonInclude() {
    return {
      orgUnit: true,
      owner: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.BusinessProcessInclude;
  }

  private withComputed<T extends { sequenceNumber: number }>(process: T) {
    return { ...process, code: businessProcessDisplayCode(process.sequenceNumber) };
  }

  private buildWhere(user: AuthenticatedUser, query: QueryBusinessProcessesDto): Prisma.BusinessProcessWhereInput {
    return {
      ...this.scope.orgUnitWhere(user, query.orgUnitId),
      criticalityTier: query.criticalityTier,
      ownerId: query.ownerId,
    };
  }

  private buildOrderBy(
    sortBy: BusinessProcessSortField = 'criticalityTier',
    sortDir: 'asc' | 'desc' = 'asc',
  ): Prisma.BusinessProcessOrderByWithRelationInput {
    switch (sortBy) {
      case 'owner':
        return { owner: { name: sortDir } };
      default:
        return { [sortBy]: sortDir };
    }
  }

  async findAll(user: AuthenticatedUser, query: QueryBusinessProcessesDto) {
    const where = this.buildWhere(user, query);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortDir);
    const pageSize = query.pageSize ?? 25;
    const page = query.page ?? 1;

    const [processes, total] = await Promise.all([
      this.prisma.businessProcess.findMany({
        where,
        include: this.commonInclude(),
        orderBy,
        ...(pageSize > 0 ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      }),
      this.prisma.businessProcess.count({ where }),
    ]);

    return { items: processes.map((p) => this.withComputed(p)), total };
  }

  /** Select shape for a Business Process embedded as a dependency reference (not its full detail). */
  private dependencySelect() {
    return {
      id: true,
      sequenceNumber: true,
      name: true,
      criticalityTier: true,
    } satisfies Prisma.BusinessProcessSelect;
  }

  private withDependencyComputed<T extends { sequenceNumber: number }>(process: T) {
    const { sequenceNumber, ...rest } = process;
    return { ...rest, code: businessProcessDisplayCode(sequenceNumber) };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const process = await this.prisma.businessProcess.findUnique({
      where: { id },
      include: {
        ...this.commonInclude(),
        riskLinks: {
          include: { risk: { include: { category: true, owner: { select: { id: true, name: true } } } } },
        },
        dependsOnLinks: { include: { dependsOn: { select: this.dependencySelect() } } },
        dependentLinks: { include: { businessProcess: { select: this.dependencySelect() } } },
      },
    });
    if (!process) throw new NotFoundException('Business process not found');
    this.scope.assertCanReadOrgUnit(user, process.orgUnitId);

    const auditHistory = await this.audit.findForEntity('BusinessProcess', id);

    return {
      ...this.withComputed(process),
      linkedRisks: process.riskLinks.map((l) => ({ ...l.risk, code: riskDisplayCode(l.risk.sequenceNumber) })),
      dependsOn: process.dependsOnLinks.map((l) => this.withDependencyComputed(l.dependsOn)),
      dependents: process.dependentLinks.map((l) => this.withDependencyComputed(l.businessProcess)),
      auditHistory,
    };
  }

  async create(dto: CreateBusinessProcessDto, user: AuthenticatedUser) {
    this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);

    const process = await this.prisma.$transaction(async (tx) => {
      const created = await tx.businessProcess.create({
        data: {
          name: dto.name,
          description: dto.description,
          orgUnitId: dto.orgUnitId,
          ownerId: dto.ownerId,
          criticalityTier: dto.criticalityTier,
          rtoMinutes: dto.rtoMinutes,
          rpoMinutes: dto.rpoMinutes,
          confidentialityScore: dto.confidentialityScore,
          integrityScore: dto.integrityScore,
          availabilityScore: dto.availabilityScore,
        },
      });
      await this.audit.record(tx, {
        entityType: 'BusinessProcess',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });

    return this.findOne(process.id, user);
  }

  async update(id: string, dto: UpdateBusinessProcessDto, user: AuthenticatedUser) {
    const existing = await this.prisma.businessProcess.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Business process not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);
    if (dto.orgUnitId && dto.orgUnitId !== existing.orgUnitId) {
      this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.businessProcess.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          orgUnitId: dto.orgUnitId,
          ownerId: dto.ownerId,
          criticalityTier: dto.criticalityTier,
          rtoMinutes: dto.rtoMinutes,
          rpoMinutes: dto.rpoMinutes,
          confidentialityScore: dto.confidentialityScore,
          integrityScore: dto.integrityScore,
          availabilityScore: dto.availabilityScore,
        },
      });
      await this.audit.record(tx, {
        entityType: 'BusinessProcess',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: existing,
        after: updated,
      });
    });

    return this.findOne(id, user);
  }

  async updateLinkedRisks(id: string, dto: LinkRisksDto, user: AuthenticatedUser) {
    const existing = await this.prisma.businessProcess.findUnique({
      where: { id },
      include: { riskLinks: true },
    });
    if (!existing) throw new NotFoundException('Business process not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.businessProcessRisk.deleteMany({ where: { businessProcessId: id } });
      await tx.businessProcessRisk.createMany({
        data: dto.riskIds.map((riskId) => ({ businessProcessId: id, riskId })),
      });
      await this.audit.record(tx, {
        entityType: 'BusinessProcess',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: { linkedRiskIds: existing.riskLinks.map((l) => l.riskId) },
        after: { linkedRiskIds: dto.riskIds },
      });
    });

    return this.findOne(id, user);
  }

  /**
   * Replaces the full set of Business Processes this one depends on (same
   * replace-all-links semantics as updateLinkedRisks). The reverse
   * direction (dependents) is purely derived - it is never written to
   * directly, only ever set by the dependent process's own PUT.
   */
  async updateDependencies(id: string, dto: LinkDependenciesDto, user: AuthenticatedUser) {
    if (dto.dependsOnIds.includes(id)) {
      throw new BadRequestException('A business process cannot depend on itself');
    }

    const existing = await this.prisma.businessProcess.findUnique({
      where: { id },
      include: { dependsOnLinks: true },
    });
    if (!existing) throw new NotFoundException('Business process not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.businessProcessDependency.deleteMany({ where: { businessProcessId: id } });
      if (dto.dependsOnIds.length > 0) {
        await tx.businessProcessDependency.createMany({
          data: dto.dependsOnIds.map((dependsOnId) => ({ businessProcessId: id, dependsOnId })),
        });
      }
      await this.audit.record(tx, {
        entityType: 'BusinessProcess',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: { dependsOnIds: existing.dependsOnLinks.map((l) => l.dependsOnId) },
        after: { dependsOnIds: dto.dependsOnIds },
      });
    });

    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.businessProcess.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Business process not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.businessProcess.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'BusinessProcess',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
    });
  }
}
