import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ControlEffectiveness, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateFrameworkDto, UpdateFrameworkDto } from './dto/framework.dto';

@Injectable()
export class FrameworksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
    private readonly audit: AuditService,
  ) {}

  private async withCoverage(framework: {
    id: string;
    controlLinks: { control: { effectiveness: ControlEffectiveness } }[];
  }) {
    const controls = framework.controlLinks.map((l) => l.control);
    const effectiveCount = controls.filter((c) => c.effectiveness === ControlEffectiveness.EFFECTIVE).length;
    const coveragePercent = controls.length > 0 ? Math.round((effectiveCount / controls.length) * 100) : 0;
    return { coveragePercent, mappedControlCount: controls.length };
  }

  async findAll(user: AuthenticatedUser, query: { orgUnitId?: string }) {
    const where: Prisma.FrameworkWhereInput = { ...this.scope.orgUnitWhere(user, query.orgUnitId) };
    const frameworks = await this.prisma.framework.findMany({
      where,
      include: {
        orgUnit: true,
        owner: { select: { id: true, name: true, email: true } },
        controlLinks: { include: { control: { select: { effectiveness: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      frameworks.map(async (f) => ({
        ...f,
        ...(await this.withCoverage(f)),
        controlLinks: undefined,
      })),
    );
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const framework = await this.prisma.framework.findUnique({
      where: { id },
      include: {
        orgUnit: true,
        owner: { select: { id: true, name: true, email: true } },
        controlLinks: {
          include: {
            control: {
              include: {
                domainCategory: true,
                orgUnit: true,
                frameworkLinks: { include: { framework: true } },
              },
            },
          },
        },
      },
    });
    if (!framework) throw new NotFoundException('Framework not found');
    this.scope.assertCanReadOrgUnit(user, framework.orgUnitId);

    const coverage = await this.withCoverage(framework);
    const auditHistory = await this.audit.findForEntity('Framework', id);

    return {
      ...framework,
      ...coverage,
      mappedControls: framework.controlLinks.map((l) => ({
        ...l.control,
        frameworks: l.control.frameworkLinks.map((fl) => fl.framework),
        frameworkLinks: undefined,
      })),
      controlLinks: undefined,
      auditHistory,
    };
  }

  async create(dto: CreateFrameworkDto, user: AuthenticatedUser) {
    this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);
    const framework = await this.prisma.$transaction(async (tx) => {
      const created = await tx.framework.create({ data: dto });
      await this.audit.record(tx, {
        entityType: 'Framework',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });
    return this.findOne(framework.id, user);
  }

  async update(id: string, dto: UpdateFrameworkDto, user: AuthenticatedUser) {
    const existing = await this.prisma.framework.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Framework not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);
    if (dto.orgUnitId && dto.orgUnitId !== existing.orgUnitId) {
      this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.framework.update({ where: { id }, data: dto });
      await this.audit.record(tx, {
        entityType: 'Framework',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.framework.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Framework not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.framework.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'Framework',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
    });
  }
}
