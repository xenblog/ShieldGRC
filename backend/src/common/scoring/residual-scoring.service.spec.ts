import { ControlEffectiveness, ResidualScoreSource, ScoreBand } from '@prisma/client';
import { ResidualScoringService } from './residual-scoring.service';
import { ControlBasedResidualScoringStrategy } from './residual-scoring.strategy';

interface FakeRiskRow {
  id: string;
  inherentScore: number;
  residualScoreOverride: number | null;
  controlLinks: { control: { effectiveness: ControlEffectiveness } }[];
}

function makeFakeDb(risks: Record<string, FakeRiskRow>, riskControlsByControl: Record<string, string[]> = {}) {
  const updates: Record<string, unknown> = {};
  return {
    risk: {
      findUnique: jest.fn(({ where: { id } }: { where: { id: string } }) => Promise.resolve(risks[id] ?? null)),
      update: jest.fn(({ where: { id }, data }: { where: { id: string }; data: unknown }) => {
        updates[id] = data;
        Object.assign(risks[id], data as object);
        return Promise.resolve(risks[id]);
      }),
    },
    riskControl: {
      findMany: jest.fn(({ where: { controlId } }: { where: { controlId: string } }) =>
        Promise.resolve((riskControlsByControl[controlId] ?? []).map((riskId) => ({ riskId }))),
      ),
    },
    updates,
  };
}

describe('ResidualScoringService', () => {
  it('computes the residual score from linked controls when there is no override', async () => {
    const db = makeFakeDb({
      r1: {
        id: 'r1',
        inherentScore: 20,
        residualScoreOverride: null,
        controlLinks: [{ control: { effectiveness: ControlEffectiveness.EFFECTIVE } }],
      },
    });
    const service = new ResidualScoringService({} as never, new ControlBasedResidualScoringStrategy());

    await service.recalculateForRisk('r1', db as never);

    expect(db.updates.r1).toEqual({
      residualScore: 6,
      residualBand: ScoreBand.MEDIUM,
      residualSource: ResidualScoreSource.COMPUTED,
    });
  });

  it('lets a manual override win over the computed value', async () => {
    const db = makeFakeDb({
      r1: {
        id: 'r1',
        inherentScore: 20,
        residualScoreOverride: 3,
        controlLinks: [{ control: { effectiveness: ControlEffectiveness.EFFECTIVE } }],
      },
    });
    const service = new ResidualScoringService({} as never, new ControlBasedResidualScoringStrategy());

    await service.recalculateForRisk('r1', db as never);

    expect(db.updates.r1).toEqual({
      residualScore: 3,
      residualBand: ScoreBand.LOW,
      residualSource: ResidualScoreSource.MANUAL,
    });
  });

  it('leaves the risk with no residual value when there is no override and no linked controls', async () => {
    const db = makeFakeDb({
      r1: { id: 'r1', inherentScore: 20, residualScoreOverride: null, controlLinks: [] },
    });
    const service = new ResidualScoringService({} as never, new ControlBasedResidualScoringStrategy());

    await service.recalculateForRisk('r1', db as never);

    expect(db.updates.r1).toEqual({ residualScore: null, residualBand: null, residualSource: null });
  });

  it('propagates a recalculation to every risk linked to a control', async () => {
    const db = makeFakeDb(
      {
        r1: {
          id: 'r1',
          inherentScore: 20,
          residualScoreOverride: null,
          controlLinks: [{ control: { effectiveness: ControlEffectiveness.EFFECTIVE } }],
        },
        r2: {
          id: 'r2',
          inherentScore: 10,
          residualScoreOverride: null,
          controlLinks: [{ control: { effectiveness: ControlEffectiveness.EFFECTIVE } }],
        },
      },
      { 'ctl-1': ['r1', 'r2'] },
    );
    const service = new ResidualScoringService({} as never, new ControlBasedResidualScoringStrategy());

    await service.recalculateForRisksLinkedToControl('ctl-1', db as never);

    expect(db.updates.r1).toMatchObject({ residualScore: 6 });
    expect(db.updates.r2).toMatchObject({ residualScore: 3 });
  });
});
