import { ScoreBand } from '@prisma/client';
import { calculateScore, computeScore, scoreToBand } from './scoring.util';

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
      [3, ScoreBand.LOW],
      [4, ScoreBand.MEDIUM],
      [7, ScoreBand.MEDIUM],
      [8, ScoreBand.HIGH],
      [14, ScoreBand.HIGH],
      [15, ScoreBand.CRITICAL],
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
});
