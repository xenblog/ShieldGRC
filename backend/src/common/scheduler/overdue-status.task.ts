import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssessmentStatus, TreatmentActionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Daily sweep that flips Assessment/TreatmentAction status to OVERDUE once
 * their due date has passed and they are not yet COMPLETED, so status
 * filters (?status=OVERDUE) stay accurate between direct edits. Dashboard
 * "overdue" tiles additionally compare dueDate directly (see
 * DashboardsService) so they never lag behind this daily sweep.
 */
@Injectable()
export class OverdueStatusTask {
  private readonly logger = new Logger(OverdueStatusTask.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async run(): Promise<void> {
    const now = new Date();

    const assessments = await this.prisma.riskAssessment.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: [AssessmentStatus.PLANNED, AssessmentStatus.IN_PROGRESS] },
      },
      data: { status: AssessmentStatus.OVERDUE },
    });

    const treatmentActions = await this.prisma.treatmentAction.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: [TreatmentActionStatus.NOT_STARTED, TreatmentActionStatus.IN_PROGRESS] },
      },
      data: { status: TreatmentActionStatus.OVERDUE },
    });

    this.logger.log(
      `Overdue sweep: ${assessments.count} assessment(s), ${treatmentActions.count} treatment action(s) marked OVERDUE`,
    );
  }
}
