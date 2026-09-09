import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, TreatmentActionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrgUnitScopeService } from '../../common/org-unit-scope/org-unit-scope.service';
import { AuditService } from '../../common/audit/audit.service';
import { AssessmentProgressService } from '../../common/assessment-progress/assessment-progress.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { assessmentDisplayCode, riskDisplayCode } from '../../common/display-code/display-code.util';
import { CreateTreatmentActionDto } from './dto/create-treatment-action.dto';
import { UpdateTreatmentActionDto } from './dto/update-treatment-action.dto';
import { QueryTreatmentActionsDto } from './dto/query-treatment-actions.dto';

function computeIsOverdue(action: { status: TreatmentActionStatus; dueDate: Date }): boolean {
  return action.status !== TreatmentActionStatus.COMPLETED && action.dueDate < new Date();
}

@Injectable()
export class TreatmentActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OrgUnitScopeService,
    private readonly audit: AuditService,
    private readonly assessmentProgress: AssessmentProgressService,
  ) {}

  private commonInclude() {
    return {
      owner: { select: { id: true, name: true } },
      risk: { select: { id: true, title: true, orgUnitId: true, sequenceNumber: true } },
      assessment: { select: { id: true, name: true, sequenceNumber: true, startDate: true } },
    } satisfies Prisma.TreatmentActionInclude;
  }

  private withComputed<
    T extends {
      status: TreatmentActionStatus;
      dueDate: Date;
      risk: { sequenceNumber: number };
      assessment: { sequenceNumber: number; startDate: Date } | null;
    },
  >(action: T) {
    return {
      ...action,
      isOverdue: computeIsOverdue(action),
      risk: { ...action.risk, code: riskDisplayCode(action.risk.sequenceNumber) },
      assessment: action.assessment
        ? { ...action.assessment, code: assessmentDisplayCode(action.assessment.sequenceNumber, action.assessment.startDate) }
        : null,
    };
  }

  async findAll(user: AuthenticatedUser, query: QueryTreatmentActionsDto) {
    const actions = await this.prisma.treatmentAction.findMany({
      where: {
        ownerId: query.ownerId,
        status: query.status,
        dueDate: { lte: query.dueBefore, gte: query.dueAfter },
        risk: this.scope.orgUnitWhere(user, query.orgUnitId),
      },
      include: this.commonInclude(),
      orderBy: { dueDate: 'asc' },
    });
    return actions.map((a) => this.withComputed(a));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const action = await this.prisma.treatmentAction.findUnique({
      where: { id },
      include: this.commonInclude(),
    });
    if (!action) throw new NotFoundException('Treatment action not found');
    this.scope.assertCanReadOrgUnit(user, action.risk.orgUnitId);
    return this.withComputed(action);
  }

  private async assertCanWriteRisk(riskId: string, user: AuthenticatedUser) {
    const risk = await this.prisma.risk.findUnique({ where: { id: riskId }, select: { orgUnitId: true } });
    if (!risk) throw new NotFoundException('Risk not found');
    this.scope.assertCanWriteOrgUnit(user, risk.orgUnitId);
  }

  async create(dto: CreateTreatmentActionDto, user: AuthenticatedUser) {
    await this.assertCanWriteRisk(dto.riskId, user);

    const action = await this.prisma.$transaction(async (tx) => {
      const created = await tx.treatmentAction.create({
        data: {
          description: dto.description,
          riskId: dto.riskId,
          assessmentId: dto.assessmentId,
          ownerId: dto.ownerId,
          status: dto.status,
          dueDate: dto.dueDate,
        },
      });
      await this.audit.record(tx, {
        entityType: 'TreatmentAction',
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        after: created,
      });
      return created;
    });

    if (action.assessmentId) {
      await this.assessmentProgress.recalculate(action.assessmentId);
    }
    return this.findOne(action.id, user);
  }

  async update(id: string, dto: UpdateTreatmentActionDto, user: AuthenticatedUser) {
    const existing = await this.prisma.treatmentAction.findUnique({
      where: { id },
      include: { risk: { select: { orgUnitId: true } } },
    });
    if (!existing) throw new NotFoundException('Treatment action not found');
    this.scope.assertCanWriteOrgUnit(user, existing.risk.orgUnitId);
    if (dto.riskId && dto.riskId !== existing.riskId) {
      await this.assertCanWriteRisk(dto.riskId, user);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.treatmentAction.update({
        where: { id },
        data: {
          description: dto.description,
          riskId: dto.riskId,
          assessmentId: dto.assessmentId,
          ownerId: dto.ownerId,
          status: dto.status,
          dueDate: dto.dueDate,
        },
      });
      await this.audit.record(tx, {
        entityType: 'TreatmentAction',
        entityId: id,
        action: AuditAction.UPDATE,
        actorId: user.id,
        before: existing,
        after: result,
      });
      return result;
    });

    // A status change or a re-link can shift either assessment's completed/total ratio.
    const affectedAssessmentIds = new Set([existing.assessmentId, updated.assessmentId].filter(Boolean) as string[]);
    await Promise.all([...affectedAssessmentIds].map((assessmentId) => this.assessmentProgress.recalculate(assessmentId)));

    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.treatmentAction.findUnique({
      where: { id },
      include: { risk: { select: { orgUnitId: true } } },
    });
    if (!existing) throw new NotFoundException('Treatment action not found');
    this.scope.assertCanWriteOrgUnit(user, existing.risk.orgUnitId);

    await this.prisma.$transaction(async (tx) => {
      await tx.treatmentAction.delete({ where: { id } });
      await this.audit.record(tx, {
        entityType: 'TreatmentAction',
        entityId: id,
        action: AuditAction.DELETE,
        actorId: user.id,
        before: existing,
      });
    });

    if (existing.assessmentId) {
      await this.assessmentProgress.recalculate(existing.assessmentId);
    }
  }
}
