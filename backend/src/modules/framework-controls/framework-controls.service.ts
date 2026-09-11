import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateFrameworkControlDto, UpdateFrameworkControlDto } from './dto/framework-control.dto';

/**
 * The individual clauses/controls within a Framework (e.g. ISO 27001:2022
 * "A.5.1"), that Control Library Controls map to - see
 * ControlsService.create/update. Reference data, not org-unit scoped like
 * Risks/Controls are (same treatment as Categories).
 */
@Injectable()
export class FrameworkControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private commonInclude() {
    return { framework: { select: { id: true, name: true } } } satisfies Prisma.FrameworkControlInclude;
  }

  findAll(query: { frameworkId?: string }) {
    const where: Prisma.FrameworkControlWhereInput = { frameworkId: query.frameworkId };
    return this.prisma.frameworkControl.findMany({
      where,
      include: this.commonInclude(),
      orderBy: [{ framework: { name: 'asc' } }, { code: 'asc' }],
    });
  }

  async findOne(id: string) {
    const clause = await this.prisma.frameworkControl.findUnique({ where: { id }, include: this.commonInclude() });
    if (!clause) throw new NotFoundException('Framework control not found');
    return clause;
  }

  async create(dto: CreateFrameworkControlDto, user: AuthenticatedUser) {
    const framework = await this.prisma.framework.findUnique({ where: { id: dto.frameworkId } });
    if (!framework) throw new NotFoundException('Framework not found');

    const clause = await this.prisma.$transaction(async (tx) => {
      const created = await tx.frameworkControl.create({
        data: { frameworkId: dto.frameworkId, code: dto.code, title: dto.title, description: dto.description },
      });
      await this.audit.record(tx, {
        entityType: 'FrameworkControl',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });

    return this.findOne(clause.id);
  }

  async update(id: string, dto: UpdateFrameworkControlDto, user: AuthenticatedUser) {
    const existing = await this.prisma.frameworkControl.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Framework control not found');

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.frameworkControl.update({
        where: { id },
        data: { code: dto.code, title: dto.title, description: dto.description },
      });
      await this.audit.record(tx, {
        entityType: 'FrameworkControl',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: existing,
        after: updated,
      });
    });

    return this.findOne(id);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.frameworkControl.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Framework control not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.frameworkControl.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'FrameworkControl',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
    });
  }
}
