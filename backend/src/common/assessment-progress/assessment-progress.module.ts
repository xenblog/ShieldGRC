import { Global, Module } from '@nestjs/common';
import { AssessmentProgressService } from './assessment-progress.service';

@Global()
@Module({
  providers: [AssessmentProgressService],
  exports: [AssessmentProgressService],
})
export class AssessmentProgressModule {}
