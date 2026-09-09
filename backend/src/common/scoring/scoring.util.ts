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
 * Low < 4 (1-3), Medium 4-7, High 8-14, Critical >= 15 (15-25).
 */
export function scoreToBand(score: number): ScoreBand {
  if (score < 1 || score > 25) {
    throw new Error('score must be between 1 and 25');
  }
  if (score < 4) return ScoreBand.LOW;
  if (score <= 7) return ScoreBand.MEDIUM;
  if (score <= 14) return ScoreBand.HIGH;
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
  // Manually entered by the risk owner (1-25) - this is intentionally NOT
  // derived from a residual likelihood/impact pair. Residual scoring is a
  // placeholder expected to become a computed value once a Control Library
  // and a Business Impact Analysis exist; until then only its band is
  // computed, live, from whatever value is currently stored.
  residualScore?: number | null;
}

export interface RiskScoringOutput {
  inherentScore: number;
  inherentBand: ScoreBand;
  residualScore: number | null;
  residualBand: ScoreBand | null;
}

/**
 * Live scoring: recompute the inherent score/band from likelihood x impact,
 * and (when a residual score is present) its band. Callers (RisksService.
 * create/update) call this every time any underlying value changes rather
 * than caching a stale computed value.
 */
export function recalculateRiskScores(input: RiskScoringInput): RiskScoringOutput {
  const inherent = computeScore(input.likelihood, input.impact);

  const residualScore = input.residualScore ?? null;
  const residualBand = residualScore != null ? scoreToBand(residualScore) : null;

  return {
    inherentScore: inherent.score,
    inherentBand: inherent.band,
    residualScore,
    residualBand,
  };
}
