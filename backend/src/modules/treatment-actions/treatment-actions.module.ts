import { Module } from '@nestjs/common';
import { TreatmentActionsController } from './treatment-actions.controller';
import { TreatmentActionsService } from './treatment-actions.service';

@Module({
  controllers: [TreatmentActionsController],
  providers: [TreatmentActionsService],
  exports: [TreatmentActionsService],
})
export class TreatmentActionsModule {}
