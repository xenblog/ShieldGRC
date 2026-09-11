import { ControlEffectiveness } from '@prisma/client';
import { ControlBasedResidualScoringStrategy } from './residual-scoring.strategy';

describe('ControlBasedResidualScoringStrategy', () => {
  const strategy = new ControlBasedResidualScoringStrategy();

  it('returns null when no controls are linked', () => {
    expect(strategy.computeResidualScore(20, [])).toBeNull();
  });

  it('reduces the inherent score using a single effective control', () => {
    // 20 * (1 - 0.7) = 6
    expect(strategy.computeResidualScore(20, [ControlEffectiveness.EFFECTIVE])).toBe(6);
  });

  it('averages the reduction across multiple linked controls', () => {
    // avg(0.7, 0.1) = 0.4 -> 20 * 0.6 = 12
    expect(
      strategy.computeResidualScore(20, [ControlEffectiveness.EFFECTIVE, ControlEffectiveness.INEFFECTIVE]),
    ).toBe(12);
  });

  it('applies zero reduction for an untested control - never inflates the residual score', () => {
    expect(strategy.computeResidualScore(10, [ControlEffectiveness.NOT_YET_TESTED])).toBe(10);
  });

  it('clamps the result to the 1-25 range', () => {
    expect(strategy.computeResidualScore(1, [ControlEffectiveness.EFFECTIVE])).toBe(1);
    expect(strategy.computeResidualScore(25, [ControlEffectiveness.INEFFECTIVE])).toBe(23);
  });
});
