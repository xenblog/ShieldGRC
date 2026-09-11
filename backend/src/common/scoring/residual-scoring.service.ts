import { Inject, Injectable } from '@nestjs/common';
import { Prisma, ResidualScoreSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { scoreToBand } from './scoring.util';
import { RESIDUAL_SCORING_STRATEGY, ResidualScoringStrategy } from './residual-scoring.strategy';

/**
 * Recomputes and persists Risk.residualScore/residualBand/residualSource for
 * one risk: a manual override (Risk.residualScoreOverride) always wins,
 * otherwise the injected ResidualScoringStrategy computes live from
 * currently linked Controls, otherwise the risk has no residual value yet.
 *
 * Lives outside RisksModule/ControlsModule (like AssessmentProgressService)
 * so both RisksService and the propagation callers below can reach it
 * without a circular module dependency.
 */
@Injectable()
export class ResidualScoringService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RESIDUAL_SCORING_STRATEGY) private readonly strategy: ResidualScoringStrategy,
  ) {}

  async recalculateForRisk(riskId: string, db: PrismaService | Prisma.TransactionClient = this.prisma): Promise<void> {
    const risk = await db.risk.findUnique({
      where: { id: riskId },
      include: { controlLinks: { include: { control: { select: { effectiveness: true } } } } },
    });
    if (!risk) return;

    const computed = this.strategy.computeResidualScore(
      risk.inherentScore,
      risk.controlLinks.map((l) => l.control.effectiveness),
    );

    const residualScore = risk.residualScoreOverride ?? computed;
    const residualSource: ResidualScoreSource | null =
      risk.residualScoreOverride != null
        ? ResidualScoreSource.MANUAL
        : computed != null
          ? ResidualScoreSource.COMPUTED
          : null;

    await db.risk.update({
      where: { id: riskId },
      data: {
        residualScore,
        residualBand: residualScore != null ? scoreToBand(residualScore) : null,
        residualSource,
      },
    });
  }

  /**
   * Propagation entry point: called after a Control's effectiveness changes
   * (see ControlsService.recomputeFromLatestTest) so every Risk currently
   * linked to that Control gets its residual score/band recomputed too.
   */
  async recalculateForRisksLinkedToControl(
    controlId: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const links = await db.riskControl.findMany({ where: { controlId }, select: { riskId: true } });
    for (const link of links) {
      await this.recalculateForRisk(link.riskId, db);
    }
  }
}
