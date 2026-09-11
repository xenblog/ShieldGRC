import { Global, Module } from '@nestjs/common';
import { ControlBasedResidualScoringStrategy, RESIDUAL_SCORING_STRATEGY } from './residual-scoring.strategy';
import { ResidualScoringService } from './residual-scoring.service';

@Global()
@Module({
  providers: [
    { provide: RESIDUAL_SCORING_STRATEGY, useClass: ControlBasedResidualScoringStrategy },
    ResidualScoringService,
  ],
  exports: [ResidualScoringService],
})
export class ResidualScoringModule {}
