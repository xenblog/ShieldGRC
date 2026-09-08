import { ScoreBand } from '@prisma/client';
import {
  calculateScore,
  computeScore,
  recalculateRiskScores,
  scoreToBand,
} from './scoring.util';

describe('scoring.util', () => {
  describe('calculateScore', () => {
    it('multiplies likelihood and impact', () => {
      expect(calculateScore(3, 4)).toBe(12);
    });

    it('rejects out-of-range values', () => {
      expect(() => calculateScore(0, 3)).toThrow();
      expect(() => calculateScore(3, 6)).toThrow();
      expect(() => calculateScore(2.5, 3)).toThrow();
    });
  });

  describe('scoreToBand', () => {
    it.each([
      [1, ScoreBand.LOW],
      [5, ScoreBand.LOW],
      [6, ScoreBand.MEDIUM],
      [10, ScoreBand.MEDIUM],
      [11, ScoreBand.HIGH],
      [15, ScoreBand.HIGH],
      [16, ScoreBand.CRITICAL],
      [25, ScoreBand.CRITICAL],
    ])('maps score %i to band %s', (score, band) => {
      expect(scoreToBand(score)).toBe(band);
    });

    it('rejects scores outside 1-25', () => {
      expect(() => scoreToBand(0)).toThrow();
      expect(() => scoreToBand(26)).toThrow();
    });
  });

  describe('computeScore', () => {
    it('combines score and band', () => {
      expect(computeScore(5, 5)).toEqual({ score: 25, band: ScoreBand.CRITICAL });
      expect(computeScore(1, 1)).toEqual({ score: 1, band: ScoreBand.LOW });
    });
  });

  describe('recalculateRiskScores', () => {
    it('computes inherent score/band without residual values', () => {
      const result = recalculateRiskScores({ likelihood: 4, impact: 4 });
      expect(result.inherentScore).toBe(16);
      expect(result.inherentBand).toBe(ScoreBand.CRITICAL);
      expect(result.residualScore).toBeNull();
      expect(result.residualBand).toBeNull();
    });

    it('computes residual score/band when residual values are present', () => {
      const result = recalculateRiskScores({
        likelihood: 5,
        impact: 5,
        residualLikelihood: 2,
        residualImpact: 2,
      });
      expect(result.inherentScore).toBe(25);
      expect(result.inherentBand).toBe(ScoreBand.CRITICAL);
      expect(result.residualScore).toBe(4);
      expect(result.residualBand).toBe(ScoreBand.LOW);
    });

    it('treats residual as absent if only one of the two values is set', () => {
      const result = recalculateRiskScores({
        likelihood: 3,
        impact: 3,
        residualLikelihood: 2,
        residualImpact: null,
      });
      expect(result.residualScore).toBeNull();
      expect(result.residualBand).toBeNull();
    });

    it('recalculates live when values change (simulating a treatment update)', () => {
      const before = recalculateRiskScores({ likelihood: 5, impact: 5 });
      const after = recalculateRiskScores({
        likelihood: 5,
        impact: 5,
        residualLikelihood: 1,
        residualImpact: 2,
      });
      expect(before.residualScore).toBeNull();
      expect(after.residualScore).toBe(2);
      expect(after.residualBand).toBe(ScoreBand.LOW);
    });
  });
});
