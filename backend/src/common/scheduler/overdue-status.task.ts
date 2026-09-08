import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TreatmentActionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Daily sweep that flips TreatmentAction status to OVERDUE once its due date
 * has passed and it is not yet COMPLETED, so status filters
 * (?status=OVERDUE) stay accurate between direct edits. Assessment
 * "overdue" is a derived, visual-only flag (dueDate passed and status not
 * COMPLETED) rather than a stored status, so it needs no sweep here - see
 * DashboardsService and RiskAssessmentsService.
 */
@Injectable()
export class OverdueStatusTask {
  private readonly logger = new Logger(OverdueStatusTask.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async run(): Promise<void> {
    const now = new Date();

    const treatmentActions = await this.prisma.treatmentAction.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: [TreatmentActionStatus.NOT_STARTED, TreatmentActionStatus.IN_PROGRESS] },
      },
      data: { status: TreatmentActionStatus.OVERDUE },
    });

    this.logger.log(`Overdue sweep: ${treatmentActions.count} treatment action(s) marked OVERDUE`);
  }
}
