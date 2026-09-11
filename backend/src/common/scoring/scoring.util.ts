import { ScoreBand } from '@prisma/client';

/**
 * Shared 5x5 qualitative scoring matrix (score = likelihood x impact,
 * banded into Low/Medium/High/Critical). Used for the inherent score and,
 * via scoreToBand, for the residual score too - see ResidualScoringService
 * for how the residual score value itself is derived. Kept as pure
 * functions (no DB/HTTP dependency) so they can be unit tested directly.
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
