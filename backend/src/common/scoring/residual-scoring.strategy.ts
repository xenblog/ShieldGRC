import { ControlEffectiveness } from '@prisma/client';

/**
 * Pluggable strategy for deriving a Risk's live residual score from the
 * Controls currently linked to it. Swappable via the RESIDUAL_SCORING_STRATEGY
 * DI token (see residual-scoring.module.ts) so a future strategy (e.g. one
 * that also weighs Business Impact Analysis criticality) can replace
 * ControlBasedResidualScoringStrategy without touching any caller.
 */
export interface ResidualScoringStrategy {
  /**
   * Returns the computed residual score (1-25), or null when there is
   * nothing to compute from (no linked Controls) - callers treat null as
   * "no computed value available", not as zero risk.
   */
  computeResidualScore(inherentScore: number, linkedControlEffectiveness: ControlEffectiveness[]): number | null;
}

export const RESIDUAL_SCORING_STRATEGY = Symbol('RESIDUAL_SCORING_STRATEGY');

// Fraction of inherent risk each control's current test result is assumed to
// remove. A control that has never been tested (NOT_YET_TESTED) is present
// but unproven, so it contributes zero reduction rather than being excluded -
// simply linking an untested control never lowers the residual score.
const REDUCTION_FACTOR: Record<ControlEffectiveness, number> = {
  [ControlEffectiveness.EFFECTIVE]: 0.7,
  [ControlEffectiveness.PARTIALLY_EFFECTIVE]: 0.4,
  [ControlEffectiveness.INEFFECTIVE]: 0.1,
  [ControlEffectiveness.NOT_YET_TESTED]: 0,
};

/**
 * Default strategy: averages each linked Control's reduction factor and
 * applies it to the inherent score. Multiple effective controls average out
 * rather than stack, so this is intentionally simple - a future strategy can
 * model diminishing returns or per-control weighting instead.
 */
export class ControlBasedResidualScoringStrategy implements ResidualScoringStrategy {
  computeResidualScore(inherentScore: number, linkedControlEffectiveness: ControlEffectiveness[]): number | null {
    if (linkedControlEffectiveness.length === 0) return null;

    const avgReduction =
      linkedControlEffectiveness.reduce((sum, e) => sum + REDUCTION_FACTOR[e], 0) / linkedControlEffectiveness.length;
    const reduced = Math.round(inherentScore * (1 - avgReduction));
    return Math.min(25, Math.max(1, reduced));
  }
}
