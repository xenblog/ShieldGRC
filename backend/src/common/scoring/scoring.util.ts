import { ScoreBand } from '@prisma/client';

/**
 * Shared 5x5 qualitative scoring matrix used for both inherent and residual
 * risk scores. Kept as pure functions (no DB/HTTP dependency) so it can be
 * unit tested directly, and so any future caller (a control-test result
 * handler, a completed treatment action handler) can trigger a recalculation
 * without going through the HTTP layer.
 */

export const MIN_SCALE_VALUE = 1;
export const MAX_SCALE_VALUE = 5;

export function assertValidScaleValue(value: number, label: string): void {
  if (!Number.isInteger(value) || value < MIN_SCALE_VALUE || value > MAX_SCALE_VALUE) {
    throw new Error(`${label} must be an integer between ${MIN_SCALE_VALUE} and ${MAX_SCALE_VALUE}`);
  }
}

export function calculateScore(likelihood: number, impact: number): number {
  assertValidScaleValue(likelihood, 'likelihood');
  assertValidScaleValue(impact, 'impact');
  return likelihood * impact;
}

/**
 * Low 1-5, Medium 6-10, High 11-15, Critical 16-25.
 */
export function scoreToBand(score: number): ScoreBand {
  if (score < 1 || score > 25) {
    throw new Error('score must be between 1 and 25');
  }
  if (score <= 5) return ScoreBand.LOW;
  if (score <= 10) return ScoreBand.MEDIUM;
  if (score <= 15) return ScoreBand.HIGH;
  return ScoreBand.CRITICAL;
}

export interface ScoreResult {
  score: number;
  band: ScoreBand;
}

export function computeScore(likelihood: number, impact: number): ScoreResult {
  const score = calculateScore(likelihood, impact);
  return { score, band: scoreToBand(score) };
}

export interface RiskScoringInput {
  likelihood: number;
  impact: number;
  residualLikelihood?: number | null;
  residualImpact?: number | null;
}

export interface RiskScoringOutput {
  inherentScore: number;
  inherentBand: ScoreBand;
  residualScore: number | null;
  residualBand: ScoreBand | null;
}

/**
 * Live scoring: recompute both inherent and (when present) residual score/band
 * from the current values. Callers (RisksService.create/update, a linked
 * control-test result, a completed treatment action) call this every time any
 * underlying value changes rather than caching a stale computed value.
 */
export function recalculateRiskScores(input: RiskScoringInput): RiskScoringOutput {
  const inherent = computeScore(input.likelihood, input.impact);

  let residualScore: number | null = null;
  let residualBand: ScoreBand | null = null;
  if (input.residualLikelihood != null && input.residualImpact != null) {
    const residual = computeScore(input.residualLikelihood, input.residualImpact);
    residualScore = residual.score;
    residualBand = residual.band;
  }

  return {
    inherentScore: inherent.score,
    inherentBand: inherent.band,
    residualScore,
    residualBand,
  };
}
