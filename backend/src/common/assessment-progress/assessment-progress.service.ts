import { Injectable } from '@nestjs/common';
import { TreatmentActionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Recomputes RiskAssessment.progressPercent from the share of its linked
 * Treatment Actions marked COMPLETED. Lives outside both the Assessments and
 * TreatmentActions modules so either one can trigger a recalculation after a
 * write without a circular module dependency.
 */
@Injectable()
export class AssessmentProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculate(assessmentId: string): Promise<void> {
    const assessment = await this.prisma.riskAssessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.progressOverride) {
      return;
    }

    const [total, completed] = await Promise.all([
      this.prisma.treatmentAction.count({ where: { assessmentId } }),
      this.prisma.treatmentAction.count({
        where: { assessmentId, status: TreatmentActionStatus.COMPLETED },
      }),
    ]);

    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    await this.prisma.riskAssessment.update({
      where: { id: assessmentId },
      data: { progressPercent },
    });
  }
}
