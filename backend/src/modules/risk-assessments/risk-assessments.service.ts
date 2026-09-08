import { Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { AssessmentProgressService } from '../../common/assessment-progress/assessment-progress.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { LinkRisksDto } from './dto/link-risks.dto';

/**
 * "Overdue" is a derived, visual-only flag (due date passed and status not
 * Completed) rather than a stored status value - see AssessmentStatus.
 */
function computeIsOverdue(assessment: { status: AssessmentStatus; dueDate: Date }): boolean {
  return assessment.status !== AssessmentStatus.COMPLETED && assessment.dueDate < new Date();
}

@Injectable()
export class RiskAssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
    private readonly audit: AuditService,
    private readonly assessmentProgress: AssessmentProgressService,
  ) {}

  private commonInclude() {
    return {
      orgUnit: true,
      leadAssessor: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.RiskAssessmentInclude;
  }

  private withComputed<T extends { status: AssessmentStatus; dueDate: Date }>(assessment: T) {
    return { ...assessment, isOverdue: computeIsOverdue(assessment) };
  }

  async findAll(user: AuthenticatedUser) {
    const assessments = await this.prisma.riskAssessment.findMany({
      where: this.scope.readWhere(user),
      include: this.commonInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return assessments.map((a) => this.withComputed(a));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const assessment = await this.prisma.riskAssessment.findUnique({
      where: { id },
      include: {
        ...this.commonInclude(),
        linkedRisks: { include: { risk: { include: { category: true, owner: { select: { id: true, name: true } } } } } },
        treatmentActions: {
          orderBy: { dueDate: 'asc' },
          include: { owner: { select: { id: true, name: true } } },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Risk assessment not found');
    this.scope.assertCanReadOrgUnit(user, assessment.orgUnitId);

    const auditHistory = await this.audit.findForEntity('RiskAssessment', id);

    return {
      ...this.withComputed(assessment),
      linkedRisks: assessment.linkedRisks.map((l) => l.risk),
      auditHistory,
    };
  }

  async create(dto: CreateAssessmentDto, user: AuthenticatedUser) {
    this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);

    const assessment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.riskAssessment.create({
        data: {
          name: dto.name,
          scope: dto.scope,
          orgUnitId: dto.orgUnitId,
          leadAssessorId: dto.leadAssessorId,
          startDate: dto.startDate,
          dueDate: dto.dueDate,
          status: dto.status,
          linkedRisks: dto.riskIds ? { create: dto.riskIds.map((riskId) => ({ riskId })) } : undefined,
        },
      });
      await this.audit.record(tx, {
        entityType: 'RiskAssessment',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });

    return this.findOne(assessment.id, user);
  }

  async update(id: string, dto: UpdateAssessmentDto, user: AuthenticatedUser) {
    const existing = await this.prisma.riskAssessment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Risk assessment not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);
    if (dto.orgUnitId && dto.orgUnitId !== existing.orgUnitId) {
      this.scope.assertCanWriteOrgUnit(user, dto.orgUnitId);
    }

    const nextOverride = dto.progressOverride ?? existing.progressOverride;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.riskAssessment.update({
        where: { id },
        data: {
          name: dto.name,
          scope: dto.scope,
          orgUnitId: dto.orgUnitId,
          leadAssessorId: dto.leadAssessorId,
          startDate: dto.startDate,
          dueDate: dto.dueDate,
          status: dto.status,
          progressOverride: dto.progressOverride,
          progressManualValue: dto.progressManualValue,
          // Manual override wins immediately; turning override off is
          // finished below by recalculating from linked Treatment Actions.
          progressPercent: nextOverride ? dto.progressManualValue ?? existing.progressManualValue ?? existing.progressPercent : undefined,
        },
      });
      await this.audit.record(tx, {
        entityType: 'RiskAssessment',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: existing,
        after: updated,
      });
    });

    if (!nextOverride) {
      await this.assessmentProgress.recalculate(id);
    }

    return this.findOne(id, user);
  }

  async updateLinkedRisks(id: string, dto: LinkRisksDto, user: AuthenticatedUser) {
    const existing = await this.prisma.riskAssessment.findUnique({
      where: { id },
      include: { linkedRisks: true },
    });
    if (!existing) throw new NotFoundException('Risk assessment not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentRisk.deleteMany({ where: { assessmentId: id } });
      await tx.assessmentRisk.createMany({
        data: dto.riskIds.map((riskId) => ({ assessmentId: id, riskId })),
      });
      await this.audit.record(tx, {
        entityType: 'RiskAssessment',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: { linkedRiskIds: existing.linkedRisks.map((l) => l.riskId) },
        after: { linkedRiskIds: dto.riskIds },
      });
    });

    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.riskAssessment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Risk assessment not found');
    this.scope.assertCanWriteOrgUnit(user, existing.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.riskAssessment.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'RiskAssessment',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
    });
  }
}
