import { Module } from '@nestjs/common';
import { ControlsModule } from '../controls/controls.module';
import { ControlTestsController } from './control-tests.controller';
import { ControlTestsService } from './control-tests.service';

@Module({
  imports: [ControlsModule],
  controllers: [ControlTestsController],
  providers: [ControlTestsService],
  exports: [ControlTestsService],
})
export class ControlTestsModule {}
