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

  /** Every Control mapped to any clause of this Framework, deduped (a Control mapped to 2 clauses counts once). */
  private controlsFor(framework: { controls: { controlLinks: { control: { id: string; effectiveness: ControlEffectiveness } }[] }[] }) {
    const byId = new Map<string, { id: string; effectiveness: ControlEffectiveness }>();
    for (const clause of framework.controls) {
      for (const link of clause.controlLinks) {
        byId.set(link.control.id, link.control);
      }
    }
    return Array.from(byId.values());
  }

  private withCoverage(framework: { controls: { controlLinks: { control: { id: string; effectiveness: ControlEffectiveness } }[] }[] }) {
    const controls = this.controlsFor(framework);
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
        controls: { include: { controlLinks: { include: { control: { select: { id: true, effectiveness: true } } } } } },
      },
      orderBy: { name: 'asc' },
    });

    return frameworks.map((f) => ({
      ...f,
      ...this.withCoverage(f),
      clauseCount: f.controls.length,
      controls: undefined,
    }));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const framework = await this.prisma.framework.findUnique({
      where: { id },
      include: {
        orgUnit: true,
        owner: { select: { id: true, name: true, email: true } },
        controls: {
          orderBy: { code: 'asc' },
          include: {
            controlLinks: {
              include: { control: { select: { id: true, code: true, name: true, effectiveness: true } } },
            },
          },
        },
      },
    });
    if (!framework) throw new NotFoundException('Framework not found');
    this.scope.assertCanReadOrgUnit(user, framework.orgUnitId);

    const coverage = this.withCoverage(framework);
    const auditHistory = await this.audit.findForEntity('Framework', id);

    return {
      ...framework,
      ...coverage,
      clauses: framework.controls.map((clause) => ({
        id: clause.id,
        code: clause.code,
        title: clause.title,
        description: clause.description,
        mappedControls: clause.controlLinks.map((l) => l.control),
      })),
      mappedControls: this.controlsFor(framework),
      controls: undefined,
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
